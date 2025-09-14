import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '../../env';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
}) : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const { session_id } = await request.json();
    
    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
    // Typically this is stored alongside the authenticated user in your database.
    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);

    if (!checkoutSession.customer) {
      return NextResponse.json({ error: 'No customer found' }, { status: 400 });
    }

    // This is the url to which the customer will be redirected when they're done
    // managing their billing with the portal.
    const returnUrl = `${env.APP_URL}/new-user/onboarding/done`

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkoutSession.customer as string,
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
