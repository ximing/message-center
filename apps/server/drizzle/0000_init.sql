CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"note" varchar(500) DEFAULT '' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_encrypted" text NOT NULL,
	"token_preview" varchar(32) NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"label" varchar(64) NOT NULL,
	"api_base" varchar(512) NOT NULL,
	"token_encrypted" text NOT NULL,
	"token_preview" varchar(32) NOT NULL,
	"remote_user_id" varchar(255) NOT NULL,
	"remote_display_name" varchar(255),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"allow_image" boolean DEFAULT false NOT NULL,
	"allow_voice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_provider_check" CHECK ("connections"."provider" IN ('inwit', 'vital', 'aimo')),
	CONSTRAINT "connections_status_check" CHECK ("connections"."status" IN ('active', 'unauthorized'))
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"rule_id" uuid,
	"connection_id" uuid NOT NULL,
	"status" varchar(32) NOT NULL,
	"skip_reason" varchar(64),
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"remote_id" varchar(255),
	"http_status" integer,
	"error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_status_check" CHECK ("deliveries"."status" IN ('queued', 'delivered', 'skipped', 'failed')),
	CONSTRAINT "deliveries_skip_reason_check" CHECK ("deliveries"."skip_reason" IS NULL OR "deliveries"."skip_reason" IN ('media_disabled', 'media_transport_pending'))
);
--> statement-breakpoint
CREATE TABLE "forward_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"match_ingress" varchar(16),
	"match_room" varchar(256),
	"match_sender" varchar(256),
	"connection_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forward_rules_match_ingress_check" CHECK ("forward_rules"."match_ingress" IS NULL OR "forward_rules"."match_ingress" IN ('wechat', 'webhook'))
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ingress" varchar(16) NOT NULL,
	"api_key_id" uuid,
	"dedup_key" varchar(64) NOT NULL,
	"sender" varchar(256) DEFAULT '' NOT NULL,
	"room" varchar(256),
	"kind" varchar(16) NOT NULL,
	"body" text NOT NULL,
	"raw_ref" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbound_messages_ingress_check" CHECK ("inbound_messages"."ingress" IN ('wechat', 'webhook')),
	CONSTRAINT "inbound_messages_kind_check" CHECK ("inbound_messages"."kind" IN ('text', 'link', 'image', 'voice'))
);
--> statement-breakpoint
CREATE TABLE "oidc_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer" varchar(512) NOT NULL,
	"sub" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"display_name" varchar(64),
	"session_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_message_id_inbound_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."inbound_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_rule_id_forward_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."forward_rules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forward_rules" ADD CONSTRAINT "forward_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forward_rules" ADD CONSTRAINT "forward_rules_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_identities" ADD CONSTRAINT "oidc_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_uidx" ON "api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_connections_user" ON "connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_message_connection_uidx" ON "deliveries" USING btree ("message_id","connection_id");--> statement-breakpoint
CREATE INDEX "idx_deliveries_status_next" ON "deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_forward_rules_user" ON "forward_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_messages_user_created" ON "inbound_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_messages_user_dedup_uidx" ON "inbound_messages" USING btree ("user_id","dedup_key");--> statement-breakpoint
CREATE UNIQUE INDEX "oidc_identities_issuer_sub_uidx" ON "oidc_identities" USING btree ("issuer","sub");--> statement-breakpoint
CREATE UNIQUE INDEX "oidc_identities_user_issuer_uidx" ON "oidc_identities" USING btree ("user_id","issuer");