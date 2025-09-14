import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '../../env';
import { getAuthenticatedUser } from '../../auth/helpers';

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

    const { quantity = 1 } = await request.json();

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: 'subscription',

      // TODO: add user id to the success url
      // REdirect to backend and set user benefits in db
      success_url: `${env.APP_URL}/new-user/onboarding/done?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/new-user/onboarding/project?canceled=true`,
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
