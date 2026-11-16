begin;
set local statement_timeout = '15s';
do $test$
declare
 b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid();
 p1 uuid; loc uuid; page uuid; card uuid; booking uuid;
 actor uuid; result jsonb; blocked boolean := false;
 slug1 text := 'reset-check-' || replace(b1::text,'-','');
 t timestamptz := now();
begin
 select user_id into actor from public.zisto_admins limit 1;
 assert actor is not null, 'Need an admin fixture';
 insert into public.businesses(id,name,slug) values (b1,'Reset verification',slug1),(b2,'Isolation verification','reset-isolation-'||replace(b2::text,'-',''));
 insert into public.connected_projects(business_id,name,live_url) values(b1,'Keep Smart Link','https://example.com') returning id into p1;
 insert into public.locations(business_id,name,slug) values(b1,'Keep location','main') returning id into loc;
 insert into public.landing_pages(location_id,name,slug,page_type) values(loc,'Keep page','home','combined') returning id into page;
 insert into public.cards(landing_page_id,name,card_type,public_token) values(page,'Keep card','nfc',gen_random_uuid()) returning id into card;
 insert into public.analytics_events(project_id,business_id,session_id,created_at) values(p1,b1,'old',t),(p1,b1,'new',t+interval '1 second');
 insert into public.events(business_id,event_name,source,created_at) values(b1,'page_view','nfc',t),(b1,'page_view','nfc',t+interval '1 second'),(b2,'page_view','direct',t);
 insert into public.appointments(business_id,customer_name,starts_at,ends_at,reminder_email_id,reminder_scheduled_for,created_at)
 values(b1,'Verification',t+interval '1 day',t+interval '1 day 30 minutes','test-not-a-real-email-id',t+interval '23 hours',t) returning id into booking;
 begin
  perform public.reset_business_activity(b1,'wrong',actor,t);
 exception when sqlstate '22023' then blocked := true;
 end;
 assert blocked, 'Wrong confirmation must fail';
 blocked := false;
 begin
  perform public.reset_business_activity(b1,slug1,gen_random_uuid(),t);
 exception when sqlstate '42501' then blocked := true;
 end;
 assert blocked, 'Non-admin must fail';
 blocked := false;
 begin
  perform public.reset_business_activity(b1,slug1,actor,t);
 exception when sqlstate 'P0001' then blocked := true;
 end;
 assert blocked, 'Pending reminders must block all deletion';
 assert (select count(*) from public.analytics_events where business_id=b1)=2, 'Failure must keep analytics';
 update public.appointments set reminder_email_id=null,reminder_scheduled_for=null where id=booking;
 result := public.reset_business_activity(b1,slug1,actor,t);
 assert (result->'deleted'->>'analytics_events')::int=1, 'Delete old analytics only';
 assert (result->'deleted'->>'events')::int=1, 'Delete old events only';
 assert (result->'deleted'->>'appointments')::int=1, 'Delete old bookings';
 assert (select count(*) from public.analytics_events where business_id=b1)=1, 'New activity must survive';
 assert (select count(*) from public.events where business_id=b2)=1, 'Other business must survive';
 assert exists(select 1 from public.businesses where id=b1), 'Business must survive';
 assert exists(select 1 from public.connected_projects where id=p1), 'Smart Link must survive';
 assert exists(select 1 from public.cards where id=card), 'Card must survive';
 result := public.reset_business_activity(b1,slug1,actor,t);
 assert (result->'deleted'->>'analytics_events')::int=0, 'Retry must be safe';
 assert not has_function_privilege('anon','public.reset_business_activity(uuid,text,uuid,timestamptz)','execute'), 'Anon cannot reset';
 assert not has_function_privilege('authenticated','public.reset_business_activity(uuid,text,uuid,timestamptz)','execute'), 'Client cannot bypass API';
 assert has_function_privilege('service_role','public.reset_business_activity(uuid,text,uuid,timestamptz)','execute'), 'API can reset';
end;
$test$;
rollback;