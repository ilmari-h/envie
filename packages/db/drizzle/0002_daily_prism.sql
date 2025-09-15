CREATE TABLE "variable_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"environment_id" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_variable_groups" (
	"required_by_environment_id" text NOT NULL,
	"variable_group_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "environments" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "variable_groups" ADD CONSTRAINT "variable_groups_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variable_groups" ADD CONSTRAINT "environment_variable_groups_required_by_environment_id_environments_id_fk" FOREIGN KEY ("required_by_environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variable_groups" ADD CONSTRAINT "environment_variable_groups_variable_group_id_variable_groups_id_fk" FOREIGN KEY ("variable_group_id") REFERENCES "public"."variable_groups"("id") ON DELETE cascade ON UPDATE no action;