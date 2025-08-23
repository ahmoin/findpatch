import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"cleanup expired cache",
	{ hours: 1 },
	internal.myFunctions.scheduledCleanup,
);

export default crons;
