CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`account_number` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_account_number_uq` ON `accounts` (`account_number`);--> statement-breakpoint
CREATE INDEX `accounts_customer_idx` ON `accounts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `bars` (
	`id` text PRIMARY KEY NOT NULL,
	`serial_number` text NOT NULL,
	`metal_id` integer NOT NULL,
	`weight_kg` text NOT NULL,
	`purity` text NOT NULL,
	`vault_id` integer NOT NULL,
	`current_account_id` text,
	`status` text DEFAULT 'in_custody' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`metal_id`) REFERENCES `metals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`current_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bars_purity_range" CHECK(CAST("bars"."purity" AS REAL) > 0 AND CAST("bars"."purity" AS REAL) <= 1),
	CONSTRAINT "bars_weight_positive" CHECK(CAST("bars"."weight_kg" AS REAL) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bars_serial_number_uq` ON `bars` (`serial_number`);--> statement-breakpoint
CREATE INDEX `bars_account_status_idx` ON `bars` (`current_account_id`,`status`);--> statement-breakpoint
CREATE TABLE `counters` (
	`prefix` text NOT NULL,
	`year` integer NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counters_prefix_year_uq` ON `counters` (`prefix`,`year`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`client_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_uq` ON `customers` (`email`);--> statement-breakpoint
CREATE TABLE `market_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metal_id` integer NOT NULL,
	`price_per_kg` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`effective_at` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`metal_id`) REFERENCES `metals`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `market_prices_metal_effective_idx` ON `market_prices` (`metal_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `metals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'kg' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metals_code_unique` ON `metals` (`code`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_number` text NOT NULL,
	`account_id` text NOT NULL,
	`metal_id` integer NOT NULL,
	`type` text NOT NULL,
	`storage_type` text NOT NULL,
	`quantity_kg` text NOT NULL,
	`bar_id` text,
	`vault_id` integer NOT NULL,
	`price_per_kg_at_time` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`metal_id`) REFERENCES `metals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bar_id`) REFERENCES `bars`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_qty_positive" CHECK(CAST("transactions"."quantity_kg" AS REAL) > 0),
	CONSTRAINT "transactions_allocated_has_bar" CHECK(("transactions"."storage_type" = 'unallocated' AND "transactions"."bar_id" IS NULL)
          OR ("transactions"."storage_type" = 'allocated' AND "transactions"."bar_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_reference_uq` ON `transactions` (`reference_number`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_account_created_idx` ON `transactions` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `transactions_bar_idx` ON `transactions` (`bar_id`);--> statement-breakpoint
CREATE TABLE `unallocated_holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`metal_id` integer NOT NULL,
	`quantity_kg` text DEFAULT '0' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`metal_id`) REFERENCES `metals`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "unallocated_holdings_qty_non_negative" CHECK(CAST("unallocated_holdings"."quantity_kg" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unallocated_holdings_account_metal_uq` ON `unallocated_holdings` (`account_id`,`metal_id`);--> statement-breakpoint
CREATE TABLE `vaults` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vaults_code_unique` ON `vaults` (`code`);