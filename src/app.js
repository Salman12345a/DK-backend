import branchOperationsRouter from "./routes/branchOperations.js";
import { scheduleBranchAutoClose } from "./schedulers/branchAutoClose.js";

// Register routes
app.use("/api/branch", branchOperationsRouter);

// Initialize schedulers
scheduleBranchAutoClose(io);
