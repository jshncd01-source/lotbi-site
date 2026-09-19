import assert from 'node:assert/strict';

const {
  createLifeActivity,
  getLifeAgenda,
  getLifeToday,
  getLifeUpcoming,
  removeLifeActivity,
  rescheduleLifeActivity,
} = await import('../site-calendar.js');
const {CORE_ORIGIN, SiteCoreError} = await import('../site-core.js');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

const readItem = {
  projection_id: 'projection_1',
  activity_id: 'activity_1',
  occurrence_id: 'occurrence_1',
  title: '병원 가기',
  local_date: '2026-09-30',
  local_datetime: '2026-09-30T15:00:00',
  temporal_kind: 'LOCAL_DATE_TIME',
  temporal_semantics: 'USER_PLANNED_TIME',
  busy: 'UNKNOWN',
  confirmation_level: 'USER_ATTESTED',
  provider_verified: false,
  source_kind: 'USER_INPUT',
  allowed_actions: ['UPDATE', 'REMOVE'],
};

const mutation = {
  activity_id: 'activity_1',
  occurrence_id: 'occurrence_1',
  title: '병원 가기',
  activity_state: 'ACTIVE',
  activity_revision: 1,
  occurrence_revision: 1,
  temporal: {
    kind: 'LOCAL_DATE_TIME',
    local_datetime: '2026-09-30T15:00:00',
    timezone_name: 'Asia/Seoul',
  },
  temporal_semantics: 'USER_PLANNED_TIME',
  busy: 'UNKNOWN',
  confirmation_level: 'USER_ATTESTED',
  provider_verified: false,
  read_your_writes: true,
};

{
  let request;
  const value = await getLifeToday('site-token', 'Asia/Seoul', async (url, init) => {
    request = {url, init};
    return jsonResponse({
      view: 'TODAY',
      as_of: '2026-09-30T00:00:00Z',
      timezone: 'Asia/Seoul',
      coverage: 'PERSONAL_ACTIVITY_ONLY',
      items: [readItem],
      ai_calls: 0,
      provider_api_calls: 0,
    });
  });

  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/today?timezone=Asia%2FSeoul`);
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.cache, 'no-store');
  assert.equal(request.init.referrerPolicy, 'no-referrer');
  assert.deepEqual(request.init.headers, {Authorization: 'Bearer site-token'});
  assert.equal(value.view, 'TODAY');
  assert.equal(value.aiCalls, 0);
  assert.equal(value.providerApiCalls, 0);
  assert.equal(value.items[0].provider_verified, false);
}

{
  let upcomingUrl = '';
  await getLifeUpcoming(
    'site-token',
    {timezone: 'Asia/Seoul', through: '2026-10-07'},
    async (url) => {
      upcomingUrl = url;
      return jsonResponse({
        view: 'UPCOMING',
        as_of: '2026-09-30T00:00:00Z',
        timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY',
        items: [],
        ai_calls: 0,
        provider_api_calls: 0,
      });
    },
  );
  assert.equal(
    upcomingUrl,
    `${CORE_ORIGIN}/v2/life/upcoming?timezone=Asia%2FSeoul&through=2026-10-07`,
  );

  let agendaUrl = '';
  await getLifeAgenda(
    'site-token',
    {timezone: 'Asia/Seoul', start: '2026-09-30', end: '2026-10-07'},
    async (url) => {
      agendaUrl = url;
      return jsonResponse({
        view: 'AGENDA',
        as_of: '2026-09-30T00:00:00Z',
        timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY',
        items: [],
        ai_calls: 0,
        provider_api_calls: 0,
      });
    },
  );
  assert.equal(
    agendaUrl,
    `${CORE_ORIGIN}/v2/life/agenda?timezone=Asia%2FSeoul&start=2026-09-30&end=2026-10-07`,
  );
}

{
  let request;
  const result = await createLifeActivity(
    'site-token',
    {
      logicalRequestId: 'req.site.calendar.create01',
      title: '병원 가기',
      temporal: {
        kind: 'LOCAL_DATE_TIME',
        local_datetime: '2026-09-30T15:00:00',
        timezone_name: 'Asia/Seoul',
      },
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse(mutation, 201);
    },
  );

  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/activities`);
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer site-token');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.init.body), {
    logical_request_id: 'req.site.calendar.create01',
    title: '병원 가기',
    temporal: {
      kind: 'LOCAL_DATE_TIME',
      local_datetime: '2026-09-30T15:00:00',
      timezone_name: 'Asia/Seoul',
    },
    temporal_semantics: 'USER_PLANNED_TIME',
    busy: 'UNKNOWN',
  });
  assert.equal(result.activityId, 'activity_1');
  assert.equal(result.providerVerified, false);
  assert.equal(result.readYourWrites, true);
}

{
  let request;
  await rescheduleLifeActivity(
    'site-token',
    'activity_1',
    {
      logicalRequestId: 'req.site.calendar.resched01',
      expectedRevision: 1,
      temporal: {
        kind: 'LOCAL_DATE_TIME',
        local_datetime: '2026-09-30T16:00:00',
        timezone_name: 'Asia/Seoul',
      },
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse({...mutation, occurrence_revision: 2});
    },
  );
  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/activities/activity_1`);
  assert.equal(request.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(request.init.body), {
    logical_request_id: 'req.site.calendar.resched01',
    expected_revision: 1,
    temporal: {
      kind: 'LOCAL_DATE_TIME',
      local_datetime: '2026-09-30T16:00:00',
      timezone_name: 'Asia/Seoul',
    },
  });
}

{
  let request;
  await removeLifeActivity(
    'site-token',
    'activity_1',
    {
      logicalRequestId: 'req.site.calendar.remove01',
      expectedRevision: 1,
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse({...mutation, activity_state: 'REMOVED', activity_revision: 2});
    },
  );
  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/activities/activity_1/remove`);
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(JSON.parse(request.init.body), {
    logical_request_id: 'req.site.calendar.remove01',
    expected_revision: 1,
  });
}

for (const payload of [
  {
    view: 'TODAY',
    as_of: '2026-09-30T00:00:00Z',
    timezone: 'Asia/Seoul',
    coverage: 'PERSONAL_ACTIVITY_ONLY',
    items: [],
    ai_calls: 1,
    provider_api_calls: 0,
  },
  {
    view: 'TODAY',
    as_of: '2026-09-30T00:00:00Z',
    timezone: 'Asia/Seoul',
    coverage: 'PERSONAL_ACTIVITY_ONLY',
    items: [],
    ai_calls: 0,
    provider_api_calls: 1,
  },
]) {
  await assert.rejects(
    () => getLifeToday('site-token', 'Asia/Seoul', async () => jsonResponse(payload)),
    error => error instanceof SiteCoreError && error.code === 'LIFE_READ_CONTRACT_INVALID',
  );
}

await assert.rejects(
  () => createLifeActivity(
    'site-token',
    {
      logicalRequestId: 'req.site.calendar.badresponse',
      title: '병원 가기',
      temporal: {kind: 'DATE_ONLY', local_date: '2026-09-30'},
    },
    async () => jsonResponse({...mutation, provider_verified: true}, 201),
  ),
  error => error instanceof SiteCoreError && error.code === 'LIFE_MUTATION_CONTRACT_INVALID',
);

await assert.rejects(
  () => getLifeToday(
    'site-token',
    'Asia/Seoul',
    async () => jsonResponse({detail: {code: 'SESSION_AUDIENCE_RESTRICTED', message: 'denied'}}, 403),
  ),
  error => error instanceof SiteCoreError && error.code === 'SESSION_AUDIENCE_RESTRICTED' && error.status === 403,
);

await assert.rejects(
  () => getLifeToday('', 'Asia/Seoul', async () => {
    throw new Error('fetch must not run');
  }),
  error => error instanceof SiteCoreError && error.code === 'SITE_SESSION_REQUIRED',
);

await assert.rejects(
  () => getLifeAgenda(
    'site-token',
    {timezone: 'bad timezone', start: '2026-09-30', end: '2026-10-01'},
    async () => {
      throw new Error('fetch must not run');
    },
  ),
  error => error instanceof SiteCoreError && error.code === 'LIFE_TIMEZONE_INVALID',
);

console.log('LOTBI Site Life Calendar client contract: PASS');
