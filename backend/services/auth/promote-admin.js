// Script to promote user to admin in mock database
const { pool } = require('./dist/config/database');

async function promoteToAdmin() {
  try {
    // Use the user ID from the registration response
    const userId = 'ccfb2319-bbbf-42df-9684-72a1a617716';
    const role = 'admin';
    
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [role, userId]
    );
    
    console.log('User promoted to admin successfully');
    
    // Verify the update
    const user = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [userId]
    );
    
    console.log('Updated user:', user.rows[0]);
    
  } catch (error) {
    console.error('Error promoting user:', error);
  }
}

promoteToAdmin();