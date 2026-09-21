import assert from 'node:assert/strict';

const {
  createLifeActivity,
  executeLifeCalendarCommand,
  previewLifeCalendarCommand,
  isExplicitLifeCalendarCommand,
  getLifeActivity,
  getLifeAgenda,
  getLifeAttention,
  getLifeToday,
  getLifeUnscheduled,
  getLifeUpcoming,
  removeLifeActivity,
  rescheduleLifeActivity,
} = await import('../site-calendar.js');
const {CORE_ORIGIN, SiteCoreError, normalizeSmartCalendarDraft, sendConversationMessage} = await import('../site-core.js?v=20260921-convcal2');

assert.equal(isExplicitLifeCalendarCommand('9월 30일 오후 3시에 병원 가'), true);
for (const value of [
  '9월 30일 오후 3시에 병원 갈까?',
  '9월 30일 오후 3시에 병원 안 가',
  '9월 30일 오후 3시에 병원 가는 일정은 등록하지 마',
  '9월 30일 오후 3시에 병원 일정 있어?',
  '9월 30일 오후 3시에 병원 가면 좋을까?',
  '9월 30일 오후 3시에 병원 갈 것 같아',
  '9월 30일 오후 3시에 민수가 병원 간대',
  '9월 30일 오후 3시에 병원 가라고 했어',
  '9월 30일 오후 3시에 친구가 병원 가기로 했어',
  '9월 30일 오후 3시에 "병원 가"라고 적혀 있어',
  '9월 30일 오후 3시에 병원 가. 그리고 10월 1일 오전 9시에 치과 가.',
]) {
  assert.equal(isExplicitLifeCalendarCommand(value), false, value);
}

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
    {logicalRequestId: 'req.site.calendar.command01', text: '9월 30일 오후 3시에 병원 가.', timezone: 'Asia/Seoul', turnCreatedAt: '2026-09-20T21:00:00+09:00'},
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
    turn_created_at: '2026-09-20T21:00:00+09:00',
  });
  assert.equal(result.assistantText, '9월 30일 오후 3시에 ‘병원 가’ 일정을 추가했어요.');
  assert.equal(result.aiCalls, 0);
  assert.equal(result.providerApiCalls, 0);
}


{
  let request;
  const preview = await previewLifeCalendarCommand(
    {
      logicalRequestId: 'req.site.calendar.preview01',
      text: '10월 3일 오전 9시에 등산 가.',
      timezone: 'Asia/Seoul',
      turnCreatedAt: '2026-09-20T21:00:00+09:00',
    },
    async (url, init) => {
      request = {url, init};
      return jsonResponse({
        title: '등산 가',
        temporal: {
          kind: 'LOCAL_DATE_TIME',
          local_datetime: '2026-10-03T09:00:00',
          timezone_name: 'Asia/Seoul',
        },
        temporal_semantics: 'USER_PLANNED_TIME',
        parser_type: 'DETERMINISTIC_KO_EXPLICIT_ACTIVITY_V1',
        ai_calls: 0,
        provider_api_calls: 0,
      });
    },
  );
  assert.equal(request.url, `${CORE_ORIGIN}/v2/life/commands/preview`);
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(request.init.headers, {'Content-Type': 'application/json'});
  assert.deepEqual(JSON.parse(request.init.body), {
    logical_request_id: 'req.site.calendar.preview01',
    text: '10월 3일 오전 9시에 등산 가.',
    timezone: 'Asia/Seoul',
    turn_created_at: '2026-09-20T21:00:00+09:00',
  });
  assert.equal(preview.title, '등산 가');
  assert.equal(preview.aiCalls, 0);
  assert.equal(preview.providerApiCalls, 0);
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
  let unscheduledUrl = '';
  const unscheduled = await getLifeUnscheduled(
    'site-token',
    async (url, init) => {
      unscheduledUrl = url;
      assert.equal(init.method, 'GET');
      return jsonResponse({
        view: 'UNSCHEDULED',
        items: [{
          ...mutation,
          title: '보험 서류 확인',
          temporal: {kind: 'UNSCHEDULED'},
        }],
        ai_calls: 0,
        provider_api_calls: 0,
      });
    },
  );
  assert.equal(unscheduledUrl, `${CORE_ORIGIN}/v2/life/unscheduled`);
  assert.equal(unscheduled.items.length, 1);
  assert.equal(unscheduled.items[0].title, '보험 서류 확인');
  assert.equal(unscheduled.items[0].temporal.kind, 'UNSCHEDULED');
  assert.equal(unscheduled.aiCalls, 0);
  assert.equal(unscheduled.providerApiCalls, 0);
}

{
  let lookupUrl = '';
  const found = await getLifeActivity(
    'site-token',
    'activity_0123456789abcdef0123456789abcdef',
    async (url, init) => {
      lookupUrl = url;
      assert.equal(init.method, 'GET');
      return jsonResponse(mutation);
    },
  );
  assert.equal(lookupUrl, `${CORE_ORIGIN}/v2/life/activity-lookups/activity_0123456789abcdef0123456789abcdef`);
  assert.equal(found.activityId, mutation.activity_id);
  assert.equal(found.occurrenceId, mutation.occurrence_id);
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


{
  const normalized = normalizeSmartCalendarDraft({
    contract_id: 'CORE-SMART-CALENDAR-DRAFT-01',
    schema_version: 1,
    source_kind: 'ATTACHMENT_AI_DRAFT',
    requires_user_confirmation: true,
    automatic_write: false,
    title: '치과 예약',
    local_date: null,
    local_time: null,
    entry: {
      amount_minor: 12000,
      currency: 'KRW',
      expense_category: 'LIVING',
      memo: '정기 검진',
      place: '전주 치과',
      merchant: '예약처',
    },
    source_attachment_ids: ['att_0123456789abcdef0123'],
  });
  assert.equal(normalized.title, '치과 예약');
  assert.equal(normalized.localDate, null);
  assert.equal(normalized.localTime, null);
  assert.equal(normalized.automaticWrite, false);
  assert.equal(normalized.requiresUserConfirmation, true);
  assert.equal(normalized.entry.amountMinor, 12000);
  assert.equal(normalized.entry.currency, 'KRW');
}

{
  let request;
  const response = await sendConversationMessage(
    'site-token',
    '이 스크린샷 일정을 캘린더에 추가해줘',
    async (url, init) => {
      request = {url, init};
      return jsonResponse({
        contract_id: 'CORE-WEB-CHAT-01',
        schema_version: 1,
        status: 'ANSWERED',
        assistant_text: '이미지에서 편집 가능한 일정 초안을 만들었어요. 저장 전에 확인해 주세요.',
        response_mode: 'AI_CALENDAR_DRAFT_NON_AUTHORITATIVE',
        correlation_id: 'corr_calendar_draft_1',
        retry_safe: true,
        follow_up: {required: false},
        intent: {action: 'UNKNOWN'},
        calendar_draft: {
          contract_id: 'CORE-SMART-CALENDAR-DRAFT-01',
          schema_version: 1,
          source_kind: 'ATTACHMENT_AI_DRAFT',
          requires_user_confirmation: true,
          automatic_write: false,
          title: '보험 서류 확인',
          local_date: null,
          local_time: null,
          entry: {
            amount_minor: null,
            currency: null,
            expense_category: null,
            memo: '사진에서 확인한 메모',
            place: null,
            merchant: null,
          },
          source_attachment_ids: ['att_0123456789abcdef0123'],
        },
      });
    },
    ['att_0123456789abcdef0123'],
    'calendar-draft-site-0001',
    'Asia/Seoul',
    '2026-09-21T08:00:00+09:00',
  );
  assert.equal(request.url, `${CORE_ORIGIN}/v2/conversation/messages`);
  assert.equal(request.init.headers['Idempotency-Key'], 'calendar-draft-site-0001');
  assert.deepEqual(JSON.parse(request.init.body).attachment_ids, ['att_0123456789abcdef0123']);
  assert.equal(response.responseMode, 'AI_CALENDAR_DRAFT_NON_AUTHORITATIVE');
  assert.equal(response.calendarDraft.title, '보험 서류 확인');
  assert.equal(response.calendarDraft.localDate, null);
  assert.equal(response.calendarDraft.entry.memo, '사진에서 확인한 메모');
}

await assert.rejects(
  () => Promise.resolve().then(() => normalizeSmartCalendarDraft({
    contract_id: 'CORE-SMART-CALENDAR-DRAFT-01',
    schema_version: 1,
    source_kind: 'ATTACHMENT_AI_DRAFT',
    requires_user_confirmation: true,
    automatic_write: false,
    title: '잘못된 날짜',
    local_date: '2026-02-30',
    local_time: null,
    entry: {
      amount_minor: null,
      currency: null,
      expense_category: null,
      memo: null,
      place: null,
      merchant: null,
    },
    source_attachment_ids: ['att_0123456789abcdef0123'],
  })),
  error => error instanceof SiteCoreError && error.code === 'WEB_CONVERSATION_CONTRACT_INVALID',
);

console.log('LOTBI Site Life Calendar client contract: PASS');
