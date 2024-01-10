exports.up = function(knex) {
    return knex.schema.table('appointments', function(table) {
      table.string('socket_id'); // Change 'string' to the type of field you want to add
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.table('appointments', function(table) {
      table.dropColumn('socket_id');
    });
  };