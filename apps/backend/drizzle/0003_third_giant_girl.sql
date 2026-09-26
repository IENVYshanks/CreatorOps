CREATE TABLE "instagram_post_sentiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"instagram_post_id" varchar(255) NOT NULL,
	"post_published_at" timestamp with time zone NOT NULL,
	"positive_count" integer NOT NULL,
	"neutral_count" integer NOT NULL,
	"negative_count" integer NOT NULL,
	"total_comments" integer NOT NULL,
	"analyzed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_post_sentiments_counts_nonnegative" CHECK ("instagram_post_sentiments"."positive_count" >= 0 AND "instagram_post_sentiments"."neutral_count" >= 0 AND "instagram_post_sentiments"."negative_count" >= 0),
	CONSTRAINT "instagram_post_sentiments_total_matches_counts" CHECK ("instagram_post_sentiments"."total_comments" = "instagram_post_sentiments"."positive_count" + "instagram_post_sentiments"."neutral_count" + "instagram_post_sentiments"."negative_count")
);
--> statement-breakpoint
ALTER TABLE "instagram_post_sentiments" ADD CONSTRAINT "instagram_post_sentiments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instagram_post_sentiments_workspace_post_unique" ON "instagram_post_sentiments" USING btree ("workspace_id","instagram_post_id");--> statement-breakpoint
CREATE INDEX "instagram_post_sentiments_workspace_published_index" ON "instagram_post_sentiments" USING btree ("workspace_id","post_published_at");