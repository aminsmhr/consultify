exports.up = function(knex) {
    return knex.schema.createTable('appointments', (table) => {
        table.increments('id').primary();
        table.integer('client_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.integer('consultant_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
        table.datetime('date_time').notNullable();
        table.string('status'); // e.g., pending, confirmed, completed, cancelled
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('appointments');
};
