const EmailTemplateModel = require('../models/emailTemplateModel');

class EmailTemplateController {
  constructor(pool) {
    this.pool = pool;
    this.emailTemplateModel = new EmailTemplateModel(pool);
  }

  initTables = async () => {
    try {
      await this.emailTemplateModel.initTables();
      console.log("Email templates table initialized.");
    } catch (error) {
      console.error("Error initializing email templates table:", error);
    }
  };

  // Create a new email template
  createTemplate = async (req, res, next) => {
    try {
      const { template_name, subject, body, type } = req.body;
      if (!template_name || !subject || !body || !type) {
        return res.status(400).json({ success: false, message: "All fields are required." });
      }
      const newTemplate = await this.emailTemplateModel.createTemplate({ template_name, subject, body, type });
      return res.status(201).json({ success: true, template: newTemplate });
    } catch (err) {
      next(err);
    }
  };

  // List all templates
  listTemplates = async (req, res, next) => {
    try {
      const templates = await this.emailTemplateModel.getAllTemplates();
      return res.json({ success: true, templates });
    } catch (err) {
      next(err);
    }
  };

  // Get template by ID
  getTemplateById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const template = await this.emailTemplateModel.getTemplateById(id);
      if (!template) {
        return res.status(404).json({ success: false, message: "Template not found." });
      }
      return res.json({ success: true, template });
    } catch (err) {
      next(err);
    }
  };

  // Update template by ID
  updateTemplateById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { template_name, subject, body, type } = req.body;
      const updatedTemplate = await this.emailTemplateModel.updateTemplateById({ id, template_name, subject, body, type });
      if (!updatedTemplate) {
        return res.status(404).json({ success: false, message: "Template not found." });
      }
      return res.json({ success: true, template: updatedTemplate });
    } catch (err) {
      next(err);
    }
  };

  // Delete template by ID
  deleteTemplateById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const deletedTemplate = await this.emailTemplateModel.deleteTemplateById(id);
      if (!deletedTemplate) {
        return res.status(404).json({ success: false, message: "Template not found." });
      }
      return res.json({ success: true, message: "Template deleted successfully." });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = EmailTemplateController;