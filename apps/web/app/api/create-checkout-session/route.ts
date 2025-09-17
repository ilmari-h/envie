import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '../../env';
import { getAuthenticatedUser } from '../../auth/helpers';
import { getDb, Schema } from '@repo/db';
import { eq } from 'drizzle-orm';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
}) : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const priceId = env.STRIPE_TEAM_PRICE_ID;
    if(!priceId) {
      return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 });
    }

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'No authenticated user found' }, { status: 401 });
    }

    const { quantity = 1, organizationName, projectName } = await request.json();
    if(!organizationName || !projectName) {
      return NextResponse.json({ error: 'Organization name and project name are required' }, { status: 400 });
    }

    const db = getDb(env.DATABASE_URL);
    const dbUser = await db.query.users.findFirst({
      where: eq(Schema.users.id, authenticatedUser.userId),
    });
    if(!dbUser) {
      return NextResponse.json({ error: 'No customer found' }, { status: 400 });
    }


    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: 'subscription',
      customer: dbUser.stripeCustomerId ?? undefined,
      metadata: {
        user_id: authenticatedUser.userId,
        initial_organization_name: organizationName,
        initial_project_name: projectName,
      },

      success_url: `${env.APP_URL}/api/finish-checkout/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/new-user`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
