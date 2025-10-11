import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '../../env';
import { getDb, Schema } from '@repo/db';
import { getAuthenticatedUser } from '../../auth/helpers';
import { eq } from 'drizzle-orm';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
}) : null;

export async function POST(_: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'No authenticated user found' }, { status: 401 });
    }

    // Get customer from db
    const db = getDb(env.DATABASE_URL);
    const customerUser = await db.query.users.findFirst({
      // @ts-ignore - Build error in GitHub Actions
      where: eq(Schema.users.id, authenticatedUser.userId),
    });
    if(!customerUser?.stripeCustomerId) {
      return NextResponse.json({ error: 'No customer found' }, { status: 400 });
    }

    // This is the url to which the customer will be redirected when they're done
    // managing their billing with the portal.
    const returnUrl = `${env.APP_URL}/dashboard`

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerUser.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Error creating portal session' },
      { status: 500 }
    );
  }
}
