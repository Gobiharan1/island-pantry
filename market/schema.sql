CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`parent` text,
	`image` text NOT NULL,
	`tint` text NOT NULL,
	FOREIGN KEY (`parent`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`code` text PRIMARY KEY NOT NULL,
	`percent` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_id` text NOT NULL,
	`variant` text NOT NULL,
	`name` text NOT NULL,
	`label` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_items_order_variant` ON `order_items` (`order_id`,`variant`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`tracking` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`method` text NOT NULL,
	`address` text NOT NULL,
	`postcode` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`notes` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer NOT NULL,
	`fee` integer NOT NULL,
	`total` integer NOT NULL,
	`coupon` text,
	`status` text NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_nonce` ON `orders` (`nonce`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`image` text NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`best` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`order_id` text NOT NULL,
	`name` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`product`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_product_order` ON `reviews` (`product`,`order_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`email` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`label` text NOT NULL,
	`price` integer NOT NULL,
	`was` integer,
	`stock` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`product`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "nonnegative_stock" CHECK("variants"."stock" >= 0)
);

--> statement-breakpoint
CREATE TRIGGER reserve_order_stock BEFORE INSERT ON order_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM variants v JOIN products p ON p.id=v.product
    WHERE v.id=NEW.variant AND v.active=1 AND p.active=1
  ) THEN RAISE(ABORT,'variant availability changed') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM variants WHERE id=NEW.variant AND price=NEW.price
  ) THEN RAISE(ABORT,'order price changed') END;
  UPDATE variants SET stock=stock-NEW.qty WHERE id=NEW.variant;
END;
--> statement-breakpoint
CREATE TRIGGER release_cancelled_stock AFTER UPDATE OF status ON orders
WHEN OLD.status <> 'cancelled' AND NEW.status = 'cancelled'
BEGIN
  UPDATE variants SET stock=stock + (
    SELECT i.qty FROM order_items i WHERE i.order_id=NEW.id AND i.variant=variants.id
  ) WHERE id IN (SELECT i.variant FROM order_items i WHERE i.order_id=NEW.id);
END;
