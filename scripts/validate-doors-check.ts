import { validateCampusDoors, CAMPUS_DOORS, CAMPUS_ROOMS } from "../src/lib/campusLayout";
const issues = validateCampusDoors();
console.log(`Rooms: ${CAMPUS_ROOMS.length}, Doors: ${CAMPUS_DOORS.length}`);
console.log(`Issues: ${issues.length}`);
for (const i of issues) console.log(JSON.stringify(i));
