// models/deleteRequest.js
class DeleteRequest {
  constructor(pool) {
    this.pool = pool;
  }

  async initTable() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS delete_requests (
          id SERIAL PRIMARY KEY,
          record_id INTEGER NOT NULL,
          record_type VARCHAR(50) NOT NULL,
          record_number VARCHAR(50),
          requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          requested_by_name VARCHAR(255),
          requested_by_email VARCHAR(255),
          reason TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          denial_reason TEXT,
          reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_delete_requests_record ON delete_requests(record_id, record_type)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_delete_requests_status ON delete_requests(status)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_delete_requests_requested_by ON delete_requests(requested_by)
      `);
    } finally {
      client.release();
    }
  }

  async create(deleteRequestData) {
    const client = await this.pool.connect();
    try {
      const {
        record_id,
        record_type,
        record_number,
        requested_by,
        requested_by_name,
        requested_by_email,
        reason,
      } = deleteRequestData;

      const result = await client.query(
        `
        INSERT INTO delete_requests (
          record_id,
          record_type,
          record_number,
          requested_by,
          requested_by_name,
          requested_by_email,
          reason,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `,
        [
          record_id,
          record_type,
          record_number || null,
          requested_by || null,
          requested_by_name || null,
          requested_by_email || null,
          reason,
        ]
      );

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getByRecord(recordId, recordType) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT * FROM delete_requests
        WHERE record_id = $1 AND record_type = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [recordId, recordType]
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async getById(id) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT dr.*,
               u.name as reviewed_by_name
        FROM delete_requests dr
        LEFT JOIN users u ON dr.reviewed_by = u.id
        WHERE dr.id = $1
      `,
        [id]
      );

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async approve(id, reviewedBy) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE delete_requests
        SET status = 'approved',
            reviewed_by = $1,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND status = 'pending'
        RETURNING *
      `,
        [reviewedBy, id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new Error("Delete request not found or already processed");
      }

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deny(id, denialReason, reviewedBy) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE delete_requests
        SET status = 'denied',
            denial_reason = $1,
            reviewed_by = $2,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND status = 'pending'
        RETURNING *
      `,
        [denialReason, reviewedBy, id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new Error("Delete request not found or already processed");
      }

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPendingRequests() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT * FROM delete_requests
        WHERE status = 'pending'
        ORDER BY created_at DESC
      `
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}

module.exports = DeleteRequest;
