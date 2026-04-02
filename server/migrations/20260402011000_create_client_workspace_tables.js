exports.up = function (knex) {
  return knex.schema
    .createTable("client_notes", (table) => {
      table.increments("id").primary();
      table
        .integer("consultant_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table
        .integer("client_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.text("note_text");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
      table.unique(["consultant_id", "client_id"]);
    })
    .createTable("client_messages", (table) => {
      table.increments("id").primary();
      table
        .integer("consultant_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table
        .integer("client_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table
        .integer("sender_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table
        .integer("recipient_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.string("subject");
      table.text("body").notNullable();
      table.boolean("is_read").notNullable().defaultTo(false);
      table.timestamp("created_at").defaultTo(knex.fn.now());
    })
    .createTable("client_message_attachments", (table) => {
      table.increments("id").primary();
      table
        .integer("message_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("client_messages")
        .onDelete("CASCADE");
      table.string("original_name").notNullable();
      table.string("stored_name").notNullable();
      table.string("mime_type");
      table.integer("size");
      table.string("file_path").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTable("client_message_attachments")
    .dropTable("client_messages")
    .dropTable("client_notes");
};
