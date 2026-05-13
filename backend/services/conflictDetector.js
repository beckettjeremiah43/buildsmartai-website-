// Pure logic conflict pre-checker — no AI, runs before every Claude call
// to catch obvious conflicts cheaply and reduce unnecessary API spend.

/**
 * Finds crew members assigned to more than one job on the same date.
 * @param {Array} assignments - from the assignments table
 * @returns {Array} conflict objects
 */
export function detectDoubleBookings(assignments) {
  const conflicts = [];

  // Group by crew_id + date
  const map = new Map();
  for (const a of assignments) {
    const key = `${a.crew_id}::${a.date}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }

  for (const [key, entries] of map) {
    if (entries.length < 2) continue;
    const [crewId] = key.split('::');
    const crewName  = entries[0].crew?.name ?? crewId;
    const jobIds    = [...new Set(entries.map(e => e.job_id))];
    if (jobIds.length < 2) continue; // same job, different time slots — not a conflict

    conflicts.push({
      conflict_type:  'double_booking',
      description:    `${crewName} is assigned to ${jobIds.length} different jobs on ${entries[0].date}.`,
      affected_jobs:  jobIds,
      affected_crew:  [crewId],
      suggestions:    [
        { action: 'Move one assignment to the next available day', impact: 'high',   detail: 'Reschedule the lower-priority job to eliminate the overlap.' },
        { action: 'Split the crew member\'s day between jobs',      impact: 'medium', detail: 'Adjust start/end times so both jobs get partial coverage.' },
        { action: 'Assign a different crew member to one job',      impact: 'medium', detail: 'Find an available crew member with matching skills.' },
      ],
      source: 'pre_check',
    });
  }

  return conflicts;
}

/**
 * Flags sub visits scheduled before a prerequisite phase is marked complete.
 * Phase dependency is encoded in job.phases as: [{ name, status, dependencies: [phaseName] }]
 * @param {Array} subSchedules
 * @param {Array} jobs
 * @returns {Array} conflict objects
 */
export function detectSubTimingIssues(subSchedules, jobs) {
  const conflicts = [];
  const jobMap    = new Map(jobs.map(j => [j.id, j]));

  for (const ss of subSchedules) {
    const job    = jobMap.get(ss.job_id);
    const phases = job?.phases ?? [];

    // Find the sub's trade phase and its dependencies
    const trade      = ss.subcontractors?.trade?.toLowerCase();
    const tradePhase = phases.find(p => p.name?.toLowerCase().includes(trade));
    if (!tradePhase?.dependencies?.length) continue;

    for (const depName of tradePhase.dependencies) {
      const dep = phases.find(p => p.name === depName);
      if (dep && dep.status !== 'complete') {
        conflicts.push({
          conflict_type: 'sub_timing',
          description:   `${ss.subcontractors?.company_name} (${trade}) is scheduled on ${ss.scheduled_date} but prerequisite phase "${depName}" on job "${job.name}" is not complete.`,
          affected_jobs: [ss.job_id],
          affected_crew: [],
          suggestions: [
            { action: `Delay sub visit until "${depName}" is complete`,  impact: 'high',   detail: 'Coordinate with the sub to push their visit date.' },
            { action: `Expedite completion of "${depName}"`,             impact: 'high',   detail: 'Add crew or overtime to finish the blocking phase in time.' },
            { action: 'Confirm with sub if partial access is acceptable', impact: 'low',   detail: 'Some trades can begin prep work before the phase is fully done.' },
          ],
          source: 'pre_check',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Flags active jobs running more than 2 days past their planned end date.
 * @param {Array} jobs
 * @returns {Array} conflict objects
 */
export function detectDelayedJobs(jobs) {
  const conflicts = [];
  const today     = new Date();
  today.setHours(0, 0, 0, 0);

  for (const job of jobs) {
    if (!job.end_date || job.status !== 'active') continue;

    const end  = new Date(job.end_date);
    const diff = Math.floor((today - end) / 86_400_000); // days overdue

    if (diff > 2) {
      conflicts.push({
        conflict_type: 'delay_cascade',
        description:   `Job "${job.name}" is ${diff} days past its planned end date and is still active. Downstream work may be blocked.`,
        affected_jobs: [job.id],
        affected_crew: [],
        suggestions: [
          { action: 'Review remaining scope and update end date',          impact: 'high',   detail: 'Set a realistic completion date so dependent scheduling adjusts.' },
          { action: 'Add crew to accelerate remaining work',               impact: 'high',   detail: 'Temporary resource increase can close the delay quickly.' },
          { action: 'Identify and communicate impact to downstream jobs',  impact: 'medium', detail: 'Notify clients and subs whose schedules depend on this job finishing.' },
        ],
        source: 'pre_check',
      });
    }
  }

  return conflicts;
}

/**
 * Runs all pre-checks against a schedule snapshot.
 * Returns a flat array of all detected conflicts.
 * @param {{ jobs: Array, assignments: Array, subSchedules: Array }} snapshot
 * @returns {Array}
 */
export function runAllChecks({ jobs = [], assignments = [], subSchedules = [] }) {
  return [
    ...detectDoubleBookings(assignments),
    ...detectSubTimingIssues(subSchedules, jobs),
    ...detectDelayedJobs(jobs),
  ];
}
