exports.up = function(knex) {
    return knex.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('first_name').notNullable();
        table.string('last_name').notNullable();
        table.integer('type').notNullable();
        table.string('address');
        table.string('phone');
        table.string('email').notNullable().unique();
        table.string('password').notNullable();
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('users');
};

