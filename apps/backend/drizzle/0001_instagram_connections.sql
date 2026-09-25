CREATE TABLE "connection_oauth_states" (
	"state_hash" varchar(64) PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"initiated_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" varchar(32) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"access_token_iv" varchar(64) NOT NULL,
	"access_token_auth_tag" varchar(64) NOT NULL,
	"access_token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connection_oauth_states" ADD CONSTRAINT "connection_oauth_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_oauth_states" ADD CONSTRAINT "connection_oauth_states_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_oauth_states_expires_at_index" ON "connection_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_workspace_platform_unique" ON "platform_connections" USING btree ("workspace_id","platform");--> statement-breakpoint
CREATE INDEX "platform_connections_workspace_id_index" ON "platform_connections" USING btree ("workspace_id");