ALTER TABLE "organizations" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;