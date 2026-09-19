import assert from 'node:assert/strict';

const {
  createLifeActivity,
  executeLifeCalendarCommand,
  getLifeAgenda,
  getLifeAttention,
  getLifeToday,
  getLifeUpcoming,
  removeLifeActivity,
  rescheduleLifeActivity,
} = await import('../site-calendar.js');
const {CORE_ORIGIN, SiteCoreError} = await import('../site-core.js?v=20260920-guest3');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

const readItem = {
  projection_id: 'projection_1',
  activity_id: 'activity_0123456789abcdef0123456789abcdef',
  occurrence_id: 'occurrence_0123456789abcdef0123456789abcdef',
  title: '병원 가기',
  activity_revision: 1,
  occurrence_revision: 1,
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
  activity_id: 'activity_0123456789abcdef0123456789abcdef',
  occurrence_id: 'occurrence_0123456789abcdef0123456789abcdef',
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
  const result = await executeLifeCalendarCommand(
    'site-token',
    {logicalRequestId: 'req.site.calendar.command01', text: '9월 30일 오후 3시에 병원 가.', timezone: 'Asia/Seoul'},
    async (url, init) => {
      request = {url, init};
      return jsonResponse({
        activity: mutation,
        assistant_text: '9월 30일 오후 3시에 ‘병원 가’ 일정을 추가했어요.',
        parser_type: 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1',
        ai_calls: 0,
        provider_api_calls: 0,
        confirmation_level: 'USER_ATTESTED',
      }, 201);
    },
  );
  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/commands`);
  assert.deepEqual(JSON.parse(request.init.body), {
    logical_request_id: 'req.site.calendar.command01',
    text: '9월 30일 오후 3시에 병원 가.',
    timezone: 'Asia/Seoul',
  });
  assert.equal(result.assistantText, '9월 30일 오후 3시에 ‘병원 가’ 일정을 추가했어요.');
  assert.equal(result.aiCalls, 0);
  assert.equal(result.providerApiCalls, 0);
}

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
  const utcValue = await getLifeToday('site-token', 'UTC', async (url) => {
    assert.equal(url, `${CORE_ORIGIN}/v2/life/today?timezone=UTC`);
    return jsonResponse({
      view: 'TODAY',
      as_of: '2026-09-30T00:00:00Z',
      timezone: 'UTC',
      coverage: 'PERSONAL_ACTIVITY_ONLY',
      items: [],
      ai_calls: 0,
      provider_api_calls: 0,
    });
  });
  assert.equal(utcValue.timezone, 'UTC');
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
  let attentionUrl = '';
  const attention = await getLifeAttention(
    'site-token',
    {timezone: 'Asia/Seoul', horizonDays: 14},
    async (url) => {
      attentionUrl = url;
      return jsonResponse({
        view: 'ATTENTION',
        as_of: '2026-09-30T00:00:00Z',
        timezone: 'Asia/Seoul',
        coverage: 'PERSONAL_ACTIVITY_ONLY',
        items: [{
          projection_id: 'attention_projection_1',
          activity_id: 'activity_0123456789abcdef0123456789abcdef',
          occurrence_id: 'occurrence_0123456789abcdef0123456789abcdef',
          title: '반품 마감',
          due_date: '2026-10-05',
          state: 'UPCOMING',
          days_until_due: 5,
          confirmation_level: 'USER_ATTESTED',
          provider_verified: false,
          source_kind: 'USER_INPUT',
          allowed_actions: ['UPDATE', 'REMOVE'],
        }],
        ai_calls: 0,
        provider_api_calls: 0,
      });
    },
  );
  assert.equal(
    attentionUrl,
    `${CORE_ORIGIN}/v2/life/attention?timezone=Asia%2FSeoul&horizon_days=14`,
  );
  assert.equal(attention.view, 'ATTENTION');
  assert.equal(attention.aiCalls, 0);
  assert.equal(attention.providerApiCalls, 0);
  assert.equal(attention.items[0].due_date, '2026-10-05');
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
  assert.equal(result.activityId, 'activity_0123456789abcdef0123456789abcdef');
  assert.equal(result.providerVerified, false);
  assert.equal(result.readYourWrites, true);
}

{
  let request;
  await rescheduleLifeActivity(
    'site-token',
    'activity_0123456789abcdef0123456789abcdef',
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
  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/activities/activity_0123456789abcdef0123456789abcdef`);
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
    'activity_0123456789abcdef0123456789abcdef',
    {
      logicalRequestId: 'req.site.calendar.remove01',
      expectedRevision: 1,
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse({...mutation, activity_state: 'REMOVED', activity_revision: 2});
    },
  );
  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/activities/activity_0123456789abcdef0123456789abcdef/remove`);
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
    items: [{...readItem, provider_verified: true}],
    ai_calls: 0,
    provider_api_calls: 0,
  },
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
