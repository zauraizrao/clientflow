import { Router } from "express";
import { portalProjectDocuments } from "../controllers/portal-documents.controller.js";

const router = Router();

router.get(
  "/projects/:projectId/documents",
  async (req, res, next) => {
    try {
      const documents = await portalProjectDocuments(
        req.params.projectId,
      );

      res.json({
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
