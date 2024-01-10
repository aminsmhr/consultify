exports.up = function(knex) {
    return knex.schema.table('appointments', function(table) {
      // Rename existing socket_id to client_socket_id
      table.renameColumn('socket_id', 'client_socket_id');
      // Add a new column for consultant_socket_id
      table.string('consultant_socket_id');
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.table('appointments', function(table) {
      // Rename back from client_socket_id to socket_id
      table.renameColumn('client_socket_id', 'socket_id');
      // Drop the consultant_socket_id column
      table.dropColumn('consultant_socket_id');
    });
  };
  