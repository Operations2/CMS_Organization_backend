// jobs/archiveCleanup.js
// This job runs daily to clean up archived organizations after 7 days

const Organization = require("../models/organization");
const Transfer = require("../models/transfer");

async function runArchiveCleanup(pool) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find organizations that were archived 7+ days ago
    // This includes both transfer-approved and delete-approved archives
    const archivedOrgsResult = await client.query(
      `
      SELECT DISTINCT o.id, o.name
      FROM organizations o
      WHERE o.status = 'Archived'
        AND o.archived_at IS NOT NULL
        AND o.archived_at <= CURRENT_TIMESTAMP - INTERVAL '7 days'
        AND o.id NOT IN (
          SELECT (task_data->>'organization_id')::integer FROM scheduled_tasks 
          WHERE task_type = 'archive_cleanup' 
          AND status = 'completed'
          AND task_data->>'organization_id' IS NOT NULL
        )
    `
    );

    const archivedOrgs = archivedOrgsResult.rows;

    for (const org of archivedOrgs) {
      console.log(`Cleaning up archived organization: ${org.name} (ID: ${org.id})`);

      // Get the record number before deletion (for potential reuse)
      const recordNumber = org.id;

      // Delete all related data
      // 1. Delete hiring managers
      await client.query(
        "DELETE FROM hiring_managers WHERE organization_id = $1",
        [org.id]
      );

      // 2. Delete jobs
      await client.query("DELETE FROM jobs WHERE organization_id = $1", [org.id]);

      // 3. Delete leads
      await client.query("DELETE FROM leads WHERE organization_id = $1", [org.id]);

      // 4. Delete notes
      await client.query(
        "DELETE FROM organization_notes WHERE organization_id = $1",
        [org.id]
      );

      // 5. Delete history
      await client.query(
        "DELETE FROM organization_history WHERE organization_id = $1",
        [org.id]
      );

      // 6. Delete documents
      await client.query(
        "DELETE FROM organization_documents WHERE organization_id = $1",
        [org.id]
      );

      // 7. Delete the organization record
      await client.query("DELETE FROM organizations WHERE id = $1", [org.id]);

      // 8. Mark cleanup task as completed
      await client.query(
        `
        UPDATE scheduled_tasks
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE task_type = 'archive_cleanup' 
          AND task_data->>'organization_id' = $1
      `,
        [org.id.toString()]
      );

      console.log(`Successfully cleaned up organization ${org.id}`);
    }

    await client.query("COMMIT");
    console.log(`Archive cleanup completed. Processed ${archivedOrgs.rows.length} organizations.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error running archive cleanup:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runArchiveCleanup };
