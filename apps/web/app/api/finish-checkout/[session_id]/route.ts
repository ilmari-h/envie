
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '../../../env';
import { getAuthenticatedUser } from '../../../auth/helpers';
import { getDb, organizationRoles, organizations, projects, users, Schema } from '@repo/db';
import { eq } from 'drizzle-orm';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
}) : null;

export async function GET(_: NextRequest, context: { params: Promise<{ session_id: string }> }) {
  const { session_id } = await context.params;
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const db = getDb(env.DATABASE_URL);
    const priceId = env.STRIPE_TEAM_PRICE_ID;
    if(!priceId) {
      return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 });
    }

    if(!session_id) {
      return NextResponse.json({ error: 'Missing session_id in query params' }, { status: 400 });
    }

    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'No authenticated user found' }, { status: 401 });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items', 'customer'],
    });
    const quantity = checkoutSession.line_items?.data[0]?.quantity;
    if(!quantity) {
      return NextResponse.json({ error: 'Missing quantity in checkout session' }, { status: 400 });
    }

    // 3 by minimum, 1 additional for each added quantity
    const amountOfUsers = quantity + 2; 
    const error = await db.transaction(async (tx) => {
      const [updatedUser] = await tx.update(users).set({
        maxOrganizations: 3,
        maxUsersPerOrganization: amountOfUsers,
        stripeCustomerId: (checkoutSession.customer as Stripe.Customer)?.id
          ? (checkoutSession.customer as Stripe.Customer).id
          : undefined,
      }).where(eq(Schema.users.id, authenticatedUser.userId)).returning();
      if(!updatedUser) {
        return { message: 'Failed to update user' };
      }

      const initialOrganizationName = checkoutSession.metadata?.initial_organization_name;
      if(initialOrganizationName) {
        const [organization] = await tx.insert(organizations).values({
          name: initialOrganizationName,
          createdById: authenticatedUser.userId,
        }).returning();
        if(!organization) {
          return { message: 'Failed to create organization' };
        }

        // Give user role to the organization
        await tx.insert(organizationRoles).values({
          organizationId: organization.id,
          userId: authenticatedUser.userId,
          canAddMembers: true,
          canCreateEnvironments: true,
          canCreateProjects: true,
          canEditProject: true,
          canEditOrganization: true,
        });
      }
      return null;
    })

    if(error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.redirect(new URL(`${env.APP_URL}/dashboard?success=true`));
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
