import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '../components/Loader.jsx';
import { useToast } from '../components/Toast.jsx';
import { FIELDS, POST_TYPES, CAPTION_STYLES } from '../utils/config.js';
import { triggerGenerate, triggerPostNow, triggerSchedule } from '../services/webhook.js';

function newRow(type = 'link') {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return { id, type, value: '' };
}

function validValues(items) {
  return items.filter(it => it.value && it.value.trim()).map(it => it.value.trim());
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;
const UPLOAD_URL = "https://script.google.com/macros/s/AKfycbxnHP4qF6dtrpZpXgY82aI4BxURLuzzrFrmZHXx8_4pd8O0TbuyrtOWnUJzA5G9XpeeGg/exec";

export default function PostCreator({ data, onNavigate, initialRecordId }) {
  const toast = useToast();
  const { records, create, patch, refresh } = data;

  const [recordId, setRecordId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(null);          // 'post' | 'schedule' 
  const [schedDate, setSchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [schedHour, setSchedHour] = useState('10');
  const [schedAmpm, setSchedAmpm] = useState('AM');
  const [timer, setTimer] = useState(0);
  const [showPreviewBtn, setShowPreviewBtn] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    eventName: '',
    date: new Date().toISOString().slice(0, 10),
    postType: 'Observance',
    captionStyle: 'Engaging',
    imagePrompt: '',
    imageItems: [newRow()]
  });


  useEffect(() => {
    if (initialRecordId) {
      const rec = records.find(r => r.id === initialRecordId);
      if (rec) {
        const f = rec.fields;
        setRecordId(rec.id);
        const links = f[FIELDS.imageLinks] || '';
        setForm({
          eventName: f[FIELDS.eventName] || '',
          date: f[FIELDS.date] || new Date().toISOString().slice(0, 10),
          postType: f[FIELDS.postType] || 'Observance',
          captionStyle: f[FIELDS.captionStyle] || 'Engaging',
          imagePrompt: f[FIELDS.imagePrompt] || '',
          imageItems: links
            ? links.split(', ').map(url => ({ id: Math.random().toString(36).slice(2), type: 'link', value: url }))
            : [newRow()]
        });
        setShowPreviewBtn(true);
      }
    } else {
      setRecordId(null);
      setForm({
        eventName: '',
        date: new Date().toISOString().slice(0, 10),
        postType: 'Observance',
        captionStyle: 'Engaging',
        imagePrompt: '',
        imageItems: [newRow()]
      });
      setShowPreviewBtn(false);
    }
  }, [initialRecordId]);

  const bound = useMemo(
    () => records.find(r => r.id === recordId) || null,
    [records, recordId]
  );

  const status = bound?.fields[FIELDS.approvalStatus];
  const isLocked = bound?.fields[FIELDS.published] === 'Posted';
  const isRegenerate = status === 'Regenerate';
  const generatedImage = bound?.fields[FIELDS.generatedImage];
  const remoteCaption = bound?.fields[FIELDS.captionDraft];

  const linkUrls = validValues(form.imageItems);
  const linkCount = linkUrls.length;
  const imageLinksString = linkUrls.join(', ');

  const linksValid = linkCount >= 1 && linkCount <= 5;

  const previewImages = (form.postType === 'Observance' || form.postType === 'Collage')
    ? [generatedImage].filter(Boolean)
    : linkUrls;

  const previewImage = previewImages[0] || null;

  /* poll Airtable while workflow runs */
  const baseline = useRef({ image: null, caption: null });
  const startedAt = useRef(0);
  useEffect(() => {
    if (!generating || !recordId) return;
    startedAt.current = Date.now();
    const t = setInterval(() => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setGenerating(false);
        toast.error('Workflow timed out — check Airtable');
        return;
      }
      console.log('[Polling] Refreshing record:', recordId);
      refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [generating, recordId, refresh, toast]);

  /* detect completion */
  useEffect(() => {
    if (!generating || !bound) return;
    const f = bound.fields;
    const img = f[FIELDS.generatedImage] || null;
    const cap = f[FIELDS.captionDraft] || null;
    const wantImage = form.postType === 'Observance';

    const gotImage = wantImage ? img && img !== baseline.current.image : true;
    const gotCaption = cap && cap !== baseline.current.caption;

    console.log('[Detection] Current Record State:', {
      id: bound.id,
      postType: form.postType,
      hasImage: !!img,
      hasCaption: !!cap,
      gotImage,
      gotCaption,
      fields: Object.keys(f)
    });

    if (gotImage && gotCaption) {
      console.log('[Detection] SUCCESS: All content found.');
      setGenerating(false);
      setShowPreviewBtn(true);
      toast.success('Content ready!');
    }
  }, [bound?.fields[FIELDS.generatedImage], bound?.fields[FIELDS.captionDraft], generating, form.postType, toast]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target?.value ?? e });

  const setImageItems = (items) => setForm({ ...form, imageItems: items });
  
  const openPreview = async () => {
    if (!recordId) return;
    try {
      await refresh();
    } catch (e) {
      console.error('Refresh error:', e);
    }
    setShowModal(true);
  };


  const canGenerate = !!form.eventName.trim() && !generating && (form.postType === 'Observance' || linksValid);

  async function doGenerate() {
    console.log('[PostCreator] Starting generation for:', form.eventName);
    if (!form.eventName.trim()) { toast.error('Add an Occasion / Event Name first'); return; }
    if (form.postType === 'Event' && linkCount < 1) { toast.error('Add at least 1 image link'); return; }
    if (form.postType === 'Collage' && (linkCount < 1 || linkCount > 5)) { toast.error('Collage needs 1–5 image links'); return; }

    setGenerating(true);
    try {
      const fields = {};

      if (form.eventName.trim()) fields[FIELDS.eventName] = form.eventName.trim();
      // if (form.date) fields[FIELDS.date] = form.date;
      if (form.postType) fields[FIELDS.postType] = form.postType;

      if (form.postType !== 'Observance') {
        if (form.captionStyle) fields[FIELDS.captionStyle] = form.captionStyle;
        if (imageLinksString) fields[FIELDS.imageLinks] = imageLinksString;
      }

      if (form.imagePrompt.trim()) fields[FIELDS.imagePrompt] = form.imagePrompt.trim();

      let targetRecordId = recordId;

      if (targetRecordId) {
        // UPDATE EXISTING - Set to Regenerate
        fields[FIELDS.approvalStatus] = 'Regenerate';
        console.log('Patching Airtable record:', targetRecordId, fields);
        await patch(targetRecordId, fields);
        toast.info('Record updated — re-running workflow…');
      } else {
        // CREATE NEW
        fields[FIELDS.approvalStatus] = 'Generate Post';
        fields[FIELDS.published] = 'Pending';
        console.log('Creating new Airtable record:', fields);
        const created = await create(fields);
        targetRecordId = created.id;
        setRecordId(targetRecordId);
        toast.info('Record created — waiting for background process…');
      }

      // Refresh baseline for detection
      const updatedRec = records.find(r => r.id === targetRecordId) || null;
      if (updatedRec) {
        baseline.current = {
          image: updatedRec.fields[FIELDS.generatedImage] || null,
          caption: updatedRec.fields[FIELDS.captionDraft] || null
        };
      }

      // Start 30s timer
      setTimer(30);
      setShowPreviewBtn(false);
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setShowPreviewBtn(true);
            setGenerating(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (e) {
      setGenerating(false);
      toast.error(e.message);
    }
  }

  async function saveDraft() {
    if (!recordId) { toast.info('Run Generate Content first to save the draft'); return; }
    setBusy('save');
    try {
      const fields = {};
      if (form.eventName) fields[FIELDS.eventName] = form.eventName;
      if (form.date) fields[FIELDS.date] = form.date;
      if (form.postType) fields[FIELDS.postType] = form.postType;
      if (form.captionStyle) fields[FIELDS.captionStyle] = form.captionStyle;
      if (form.imagePrompt) fields[FIELDS.imagePrompt] = form.imagePrompt;
      if (imageLinksString) fields[FIELDS.imageLinks] = imageLinksString;

      await patch(recordId, fields);
      toast.success('Draft saved');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function doPostNow() {
    if (!recordId || !remoteCaption) { toast.error('Generate content first'); return; }
    if (bound && bound.fields[FIELDS.approvalStatus] !== 'Approved') {
      try { await patch(recordId, { [FIELDS.approvalStatus]: 'Approved' }); }
      catch (e) { toast.error(e.message); return; }
    }
    setBusy('post');
    try {
      // await triggerPostNow({
      //   recordId,
      //   post_type: form.postType,
      //   caption: remoteCaption,
      //   image_url: generatedImage,
      //   image_links: linkUrls
      // });
      toast.success('Posted to LinkedIn. Redirecting…');
      setTimeout(() => {
        refresh();
        onNavigate('schedule');
      }, 2000);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function doSchedule() {
    if (!schedDate) { toast.error('Pick a date'); return; }
    if (!recordId || !remoteCaption) { toast.error('Generate content first'); return; }
    setBusy('schedule');
    try {
      let h = parseInt(schedHour);
      if (schedAmpm === 'PM' && h < 12) h += 12;
      if (schedAmpm === 'AM' && h === 12) h = 0;

      const d = new Date(schedDate);
      d.setHours(h, 0, 0, 0);
      const iso = d.toISOString();

      // await triggerSchedule({
      //   recordId,
      //   post_type: form.postType,
      //   caption: remoteCaption,
      //   image_url: generatedImage,
      //   image_links: linkUrls
      // }, iso);
      await patch(recordId, {
        [FIELDS.postDate]: iso.slice(0, 10),
        [FIELDS.schedulingDate]: iso,
        [FIELDS.published]: 'Scheduled'
      });
      toast.success('Scheduled');
      onNavigate('schedule');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  const captionWordCount = remoteCaption ? remoteCaption.trim().split(/\s+/).length : 0;
  const readability = Math.max(40, Math.min(100, 100 - Math.abs(120 - captionWordCount) / 2));
  const canPublish = !!recordId && !!remoteCaption && !generating && !isLocked;

  return (
    <>
      <header className="sticky top-0 z-20 glass border-b border-cream-300/60">
        <div className="px-10 h-16 flex items-center gap-4">
          <div className="h-display text-2xl text-ink-900 ">Post Creator</div>
          {/* <span className="text-[11px] uppercase tracking-[0.16em] font-semibold bg-brand-100 text-brand-700 rounded-full px-2.5 py-1 inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-700 animate-pulse-soft" />

          </span> */}
          {generating && (
            <span className="text-xs text-accent-blue inline-flex items-center gap-2 ml-2 animate-fade-in">
              <Spinner /> Workflow running…
            </span>
          )}
        </div>
      </header>

      <main className="px-4 lg:px-10 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 max-w-7xl w-full mx-auto">
        {/* LEFT — editor */}
        <div className="space-y-6 stagger min-w-0">

          {/* Occasion / Event Name */}
          <Section title="Occasion / Event Name">
            <input
              value={form.eventName}
              onChange={set('eventName')}
              disabled={isLocked}
              placeholder="Occasion / Event Name..."
              className="input text-lg lg:text-xl h-display font-bold placeholder:text-ink-900/30"
            />
            <div className="mt-3 flex items-center gap-3">
              <Field label="Date" className="w-full sm:w-44">
                <input type="date" value={form.date} onChange={set('date')} disabled={isLocked} className="input" />
              </Field>
            </div>
          </Section>

          {/* Step 2 — Post Type */}
          <Section title="Post Type">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {POST_TYPES.map((t) => {
                const active = form.postType === t;
                return (
                  <button
                    key={t}
                    onClick={() => !isLocked && setForm({ ...form, postType: t })}
                    disabled={isLocked}
                    className={[
                      'relative rounded-xl border px-4 py-3 text-left overflow-hidden min-h-[70px]',
                      'transition-all duration-300 ease-snap will-change-transform',
                      active
                        ? 'bg-gradient-to-br from-brand-100 to-brand-50 border-brand-300 text-brand-700 shadow-glow scale-[1.01]'
                        : 'bg-white border-cream-300/60 text-ink-700 hover:border-brand-200 hover:-translate-y-0.5 hover:shadow-soft'
                    ].join(' ')}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand-700 animate-pulse-soft" />
                    )}
                    <div className="font-semibold flex items-center gap-2">
                      <PostTypeIcon type={t} />
                      {t}
                    </div>
                    <div className="text-[10px] lg:text-xs text-ink-500 mt-1 uppercase lg:capitalize tracking-tight">
                      {t === 'Observance' && (window.innerWidth < 640 ? 'AI Visual' : 'AI-generated visual')}
                      {t === 'Event' && (window.innerWidth < 640 ? '1–5 links' : '1–5 image links')}
                      {t === 'Collage' && (window.innerWidth < 640 ? '1–5 links' : '1–5 image links')}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Conditional panel */}
            <div key={form.postType} className="mt-5 animate-fade-up">
              {form.postType === 'Observance' && (
                <ObservancePanel form={form} set={set} disabled={isLocked} />
              )}
              {form.postType === 'Event' && (
                <LinksPanel
                  title="Image Links"
                  hint="Add 1 or more images (max 5)"
                  form={form}
                  set={set}
                  items={form.imageItems}
                  onItemsChange={setImageItems}
                  min={1}
                  max={5}
                  valid={linksValid}
                  validHint={linkCount >= 1 ? `${linkCount} image${linkCount === 1 ? '' : 's'} attached` : 'Need at least 1 image'}
                  disabled={isLocked}
                  toast={toast}
                />
              )}
              {form.postType === 'Collage' && (
                <LinksPanel
                  title="Collage Image Links"
                  hint="Provide 1 to 5 images for the collage"
                  form={form}
                  set={set}
                  items={form.imageItems}
                  onItemsChange={setImageItems}
                  min={1}
                  max={5}
                  valid={linksValid}
                  validHint={`${linkCount} image${linkCount === 1 ? '' : 's'} — ${linksValid ? 'looks good' : 'need 1 to 5'}`}
                  disabled={isLocked}
                  toast={toast}
                />
              )}
            </div>
          </Section>

          {/* Step 3 — Caption Style */}
          <Section step="3" title="Caption Style">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CAPTION_STYLES.map((s) => {
                const active = form.captionStyle === s;
                return (
                  <button
                    key={s}
                    onClick={() => !isLocked && setForm({ ...form, captionStyle: s })}
                    disabled={isLocked}
                    className={[
                      'rounded-lg border px-3 py-2.5 text-sm relative overflow-hidden',
                      'transition-all duration-200 ease-snap',
                      active
                        ? 'bg-gradient-to-br from-brand-100 to-brand-50 border-brand-300 text-brand-700 font-semibold shadow-soft'
                        : 'bg-white border-cream-300/60 text-ink-700 hover:border-brand-200 hover:-translate-y-0.5'
                    ].join(' ')}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Generate Content — single CTA */}
          <div className="card p-6 relative overflow-hidden">
            {generating && (
              <div className="absolute inset-x-0 top-0 h-1 bg-cream-200 overflow-hidden">
                <div className="h-full bg-brand-gradient origin-left animate-progress-indet" />
              </div>
            )}
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="min-w-0">
                <h3 className="h-display text-xl text-ink-900">Generate Content</h3>
                <p className="text-sm text-ink-600 mt-1">
                  {generating
                    ? 'Workflow is running. Sit tight — we\'ll open the pipeline when it\'s ready.'
                    : 'Submit your idea and let AI create the content'}
                </p>
                {generating && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-500">
                    <Pill>Event Name</Pill>
                    <Pill>Post Type</Pill>
                    <Pill>Caption Style</Pill>
                    {form.postType !== 'Observance' && <Pill>Image Links</Pill>}
                  </div>
                )}
              </div>
              <button
                onClick={doGenerate}
                disabled={!canGenerate}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
              >
                {generating ? (
                  <>
                    <Spinner /> Running workflow…
                  </>
                ) : (
                  <>
                    <SparkleIcon /> {recordId ? 'Regenerate Content' : 'Generate Content'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview State Button Block */}
          {(timer > 0 || showPreviewBtn) && (
            <div className="mt-4 animate-fade-up">
              <button
                disabled={timer > 0}
                onClick={openPreview}
                className={`w-full rounded-xl p-4 flex items-center justify-between transition-all duration-300 shadow-sm border ${timer > 0
                  ? 'bg-cream-100 border-cream-200 cursor-not-allowed opacity-80 shadow-none'
                  : 'bg-brand-50 border-brand-200 group hover:bg-brand-100 cursor-pointer shadow-md'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white shadow-soft transition-all ${timer > 0 ? 'bg-brand-700' : 'bg-brand-gradient group-hover:scale-110'
                    }`}>
                    {timer > 0 ? (
                      <div className="text-[10px] font-bold">{timer}s</div>
                    ) : (
                      <SparkleIcon />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-ink-900 leading-tight">
                      {timer > 0 ? 'Your preview is about to be ready, waiting for a minute' : 'Preview Now'}
                    </div>
                    <div className="text-xs text-brand-600 mt-0.5 font-medium">
                      {timer > 0 ? 'AI is stitching your visual & caption...' : 'Click to see how it looks on LinkedIn'}
                    </div>
                  </div>
                </div>
                {!showPreviewBtn ? (
                  <div className="h-2 w-12 bg-brand-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 animate-progress-indet origin-left" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-white border border-brand-200 flex items-center justify-center text-brand-700 group-hover:bg-brand-700 group-hover:text-white transition-colors">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          )}

        </div>

        {/* RIGHT — preview only */}
        <aside className="space-y-5 stagger">
          <LinkedInPost
            caption={remoteCaption}
            images={previewImages}
            eventName={form.eventName}
            isSidebar
            generating={generating && (form.postType === 'Observance' || form.postType === 'Collage')}
            blurred={!recordId}
            onClick={openPreview}
          />

          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cream-50 border border-blue-100 p-5 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-100/40 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-accent-blue font-semibold">
                <span className="h-7 w-7 rounded-lg bg-accent-blue text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Schedule Post
              </div>
              <p className="text-sm text-ink-700 mt-2.5">
                {isLocked
                  ? 'This post has already been published to LinkedIn.'
                  : canPublish
                    ? 'Post is ready. Publish straight to LinkedIn or schedule a drop.'
                    : 'Run Generate Content first, then publish or schedule from here.'}
              </p>
              <button
                onClick={doPostNow}
                disabled={!canPublish || busy === 'post'}
                className="mt-4 w-full btn-blue inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy === 'post' ? <Spinner /> : <SendIcon />} Post Now
              </button>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <input
                      type="date"
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      disabled={isLocked}
                      className="input w-full"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={schedHour}
                      onChange={(e) => setSchedHour(e.target.value)}
                      disabled={isLocked}
                      className="input w-16 px-2 text-center"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={schedAmpm}
                      onChange={(e) => setSchedAmpm(e.target.value)}
                      disabled={isLocked}
                      className="input w-16 px-1 text-center font-bold"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={doSchedule}
                  disabled={!canPublish || busy === 'schedule' || !schedDate}
                  className="w-full btn-ghost border-blue-200 text-accent-blue font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-50"
                >
                  {busy === 'schedule' ? <Spinner /> : <ClockIcon />}
                  Schedule Post
                </button>
              </div>
            </div>
          </div>

          {/* <div className="card p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-ink-500 font-semibold mb-2">Post Optimization</div>
            <div className="flex items-center justify-between">
              <span className="text-ink-700">Readability Score</span>
              <span className="text-brand-700 font-semibold tabular-nums">{Math.round(readability)}/100</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-cream-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-700 rounded-full transition-[width] duration-700 ease-snap"
                style={{ width: `${readability}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-accent-green">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Optimized for LinkedIn Algorithm
            </div>
          </div> */}

          {/* <button
            onClick={saveDraft}
            disabled={!recordId || busy === 'save'}
            className="w-full btn-ghost inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy === 'save' ? <Spinner /> : <SaveIcon />} Save Draft
          </button> */}
        </aside>
      </main>

      {/* LinkedIn Preview Modal */}
      {showModal && createPortal(
        <LinkedInModal
          onClose={() => setShowModal(false)}
          caption={remoteCaption || "Writing your caption..."}
          images={previewImages}
          eventName={form.eventName}
        />,
        document.body
      )}
    </>
  );
}

/* ----- sub-panels per post type ----- */

function ObservancePanel({ form, set, disabled }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-cream-100 to-cream-50 border border-cream-300/60 p-4">
      <Field label="Personal Touch (optional)">
        <textarea
          rows={2}
          value={form.imagePrompt}
          onChange={set('imagePrompt')}
          disabled={disabled}
          placeholder="Mood, brand colors, style…"
          className="input text-sm"
        />
      </Field>
      <div className="mt-2 text-xs text-ink-500">
        AI will craft the visual using the event name above.
      </div>
    </div>
  );
}

function LinksPanel({ title, hint, form, set, items, onItemsChange, min, max, valid, validHint, disabled, toast }) {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState('upload'); // 'upload' or 'link'
  const fileInputRef = useRef(null);

  const handleUpload = async (files) => {
    if (disabled || uploading) return;
    if (files.length === 0) return;

    if (items.filter(it => it.value).length + files.length > max) {
      toast.error(`Maximum ${max} images allowed`);
      return;
    }

    setUploading(true);
    try {
      const imagesPayload = await Promise.all(
        Array.from(files).map(async (file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const buffer = e.target.result;
              const data = Array.from(new Uint8Array(buffer));
              resolve({ title: file.name, data });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
        })
      );

      console.log('[Upload] post_type being sent:', form.postType?.toLowerCase());
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          post_type: form.postType?.toLowerCase() || 'event',
          images: imagesPayload
        })
      });

      const result = await res.json();
      console.log('[Upload] Server response:', result);

      if (result.success && result.links) {
        const links = result.links.split(',').map(s => s.trim());
        const newItems = links.map(link => ({
          id: Math.random().toString(36).slice(2),
          type: 'link',
          value: link
        }));

        const currentValid = items.filter(it => it.value);
        onItemsChange([...currentValid, ...newItems]);
        toast.success(`Successfully uploaded ${links.length} image(s)`);
      } else {
        const errorMsg = result.error || result.message || 'Upload failed';
        throw new Error(errorMsg);
      }
    } catch (e) {
      console.error('Upload Error:', e);
      toast.error(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateItem = (id, val) => {
    onItemsChange(items.map(it => it.id === id ? { ...it, value: val } : it));
  };

  const remove = (id) => {
    if (disabled) return;
    const next = items.filter(it => it.id !== id);
    onItemsChange(next.length ? next : [newRow()]);
  };

  const addRow = () => {
    if (items.length >= max) return;
    onItemsChange([...items, newRow()]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files);
    }
  };

  const validItems = items.filter(it => it.value);

  return (
    <div className="rounded-xl bg-gradient-to-br from-cream-100 to-cream-50 border border-cream-300/60 p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-500 font-semibold">{title}</div>
          <div className="text-xs text-ink-500 mt-0.5">{hint}</div>
        </div>
        <div className="inline-flex p-0.5 bg-cream-100 rounded-lg flex-shrink-0">
          {/* <TypeBtn active={mode === 'link'} onClick={() => setMode('link')} disabled={disabled}>
            <LinkIcon /> Copy Link
          </TypeBtn> */}
          <TypeBtn active={mode === 'upload'} onClick={() => setMode('upload')} disabled={disabled}>
            <UploadIcon /> Explore
          </TypeBtn>
        </div>
      </div>

      {mode === 'upload' ? (
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${uploading ? 'bg-cream-100 border-cream-300 pointer-events-none' : 'bg-white border-cream-300/60 hover:border-brand-300 hover:bg-brand-50/30'
            }`}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => handleUpload(e.target.files)}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-brand-600" />
              <div className="text-sm font-medium text-ink-700">Uploading to Cloud...</div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <UploadIcon />
              </div>
              <div>
                <div className="text-sm font-bold text-ink-900">Drag & Drop images here</div>
                <div className="text-xs text-ink-500 mt-1">PNG, JPG, WEBP (Max 5MB each)</div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 btn-ghost text-brand-700 bg-white border-brand-200 hover:bg-brand-50"
              >
                Explore Files
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <LinkRow
              key={item.id}
              index={i + 1}
              value={item.value}
              onUpdate={(v) => updateItem(item.id, v)}
              onRemove={() => remove(item.id)}
              canRemove={items.length > 1}
              disabled={disabled}
            />
          ))}
          {items.length < max && (
            <button
              type="button"
              onClick={addRow}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-brand-300/70 text-brand-700 px-3 py-2 text-sm font-medium hover:bg-brand-50 transition"
            >
              <PlusCircleIcon /> Add Link Row
            </button>
          )}
        </div>
      )}

      {/* Preview Section */}
      {validItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
          {validItems.map((item) => (
            <div key={item.id} className="group relative aspect-square rounded-lg border border-cream-300/60 bg-white overflow-hidden shadow-sm animate-fade-in">
              <img
                src={item.value}
                className="h-full w-full object-cover"
                alt="Uploaded"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e) => { e.target.src = ''; e.target.alt = 'Preview unavailable'; }}
              />
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className={`text-xs inline-flex items-center gap-1.5 transition-colors ${valid ? 'text-accent-green' : 'text-accent-amber'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${valid ? 'bg-accent-green' : 'bg-accent-amber animate-pulse-soft'}`} />
          {validHint}
        </div>
      </div>

      <div className="border-t border-cream-300/60 pt-3">
        <Field label="Personal Touch (optional)">
          <textarea
            rows={2}
            value={form.imagePrompt}
            onChange={set('imagePrompt')}
            disabled={disabled}
            placeholder="Cropping, mood, branding…"
            className="input text-sm"
          />
        </Field>
      </div>
    </div>
  );
}

function LinkRow({ index, value, onUpdate, onRemove, canRemove, disabled }) {
  return (
    <div className="rounded-xl border border-cream-300/60 bg-white p-3 transition-all hover:border-brand-200 animate-fade-in text-ink-900 group">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-ink-500 font-semibold">
          Image {index}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="rounded-md p-1.5 text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition"
          >
            <XIcon />
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
          <LinkIcon />
        </span>
        <input
          value={value}
          onChange={(event) => onUpdate(event.target.value)}
          disabled={disabled}
          placeholder="https://example.com/image.jpg"
          className="input text-sm"
          style={{ paddingLeft: '2.75rem' }}
        />
      </div>
    </div>
  );
}

function TypeBtn({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200',
        active
          ? 'bg-white text-brand-700 shadow-soft'
          : 'text-ink-600 hover:text-ink-900'
      ].join(' ')}
    >
      {children}
    </button>
  );
}

const PlusCircleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" strokeLinecap="round" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DriveIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M7.71 3.5L1.15 15l3.42 6L11 9.5 7.71 3.5zM22.85 15l-6.56-11.5h-6.84L16 15h6.85zM5.43 22.5h13.14L22 16.5H8.86l-3.43 6z" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
  </svg>
);

function GeneratingTile() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-700 gap-3 bg-gradient-to-br from-cream-100 to-brand-50">
      <div className="absolute inset-0 shimmer opacity-60" />
      <div className="relative flex flex-col items-center gap-3 animate-fade-in">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center animate-breathe shadow-glow">
          <svg viewBox="0 0 24 24" className="h-6 w-6 animate-spin-slow" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="font-medium text-ink-900">Generating visual…</div>
        <div className="text-xs text-ink-500">Workflow is running</div>
        <div className="h-1 w-32 bg-cream-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 origin-left animate-progress-indet" />
        </div>
      </div>
    </div>
  );
}

/* ----- shared ----- */

function Section({ title, children }) {
  return (
    <section className="card card-hover p-6">
      <div className="mb-4">
        <h2 className="h-display text-xl text-ink-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-ink-500 font-semibold mb-1.5">{label}</div>
      {hint && <div className="text-xs text-ink-500 mb-1.5 -mt-0.5 normal-case tracking-normal font-normal">{hint}</div>}
      {children}
    </label>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full bg-cream-100 border border-cream-300/60 px-2 py-0.5 text-[11px] text-ink-700">
      {children}
    </span>
  );
}

function PostTypeIcon({ type }) {
  if (type === 'Observance') return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" strokeLinejoin="round" />
    </svg>
  );
  if (type === 'Event') return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" strokeLinejoin="round" />
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 5v14h14V8l-3-3H5z" /><path d="M8 5v5h7V5M8 14h8v5H8z" />
  </svg>
);

function PreviewButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-brand-700 font-medium text-sm hover:text-brand-800">
      <SparkleIcon /> Preview Post
    </button>
  );
}

function LinkedInModal({ onClose, caption, images, eventName }) {
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[480px] h-full max-h-[85vh] bg-[#f3f2ef] rounded-xl shadow-2xl overflow-hidden animate-zoom-in flex flex-col pointer-events-auto">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-cream-200 sticky top-0 z-10">
          <div className="font-bold text-ink-900 text-sm">LinkedIn Preview</div>
          <button onClick={onClose} className="p-1 hover:bg-cream-100 rounded-full transition-colors text-ink-500">
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <LinkedInPost
            caption={caption}
            images={images}
            eventName={eventName}
          />
          <div className="h-4" /> {/* bottom padding */}
        </div>
      </div>
    </div>
  );
}

function LinkedInPost({ caption, images = [], eventName, isSidebar = false, generating = false, blurred = false, onClick }) {
  const [idx, setIdx] = useState(0);
  const image = images[idx] || null;

  if (isSidebar) {
    return (
      <div
        onClick={onClick}
        className={`rounded-2xl overflow-hidden bg-white border border-cream-300/60 shadow-soft transition-all duration-700 
          ${blurred ? 'blur-[2px] grayscale opacity-60' : ''} 
          ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-brand-200' : ''}`}
      >
        <div className="aspect-square bg-cream-200 relative overflow-hidden">
          {generating ? (
            <GeneratingTile />
          ) : image ? (
            <img
              key={image}
              src={image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover animate-fade-in"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-ink-500 text-sm px-6 text-center italic">
              Preview will be visible after generation
            </div>
          )}

          {image && (
            <>
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 text-white text-xs font-medium tracking-wide">
                {eventName || 'Untitled'}
              </div>
            </>
          )}
        </div>
        <div className="px-4 py-3 flex items-center justify-between text-xs text-ink-500">
          <span className="uppercase tracking-wider">Preview · Square Aspect</span>
          <span className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i === 0 ? 'bg-brand-700' : 'bg-cream-300'}`} />
            ))}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-black/10 overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-start gap-2">
        <div className="h-12 w-12 rounded-full overflow-hidden bg-cream-200 shadow-inner flex-shrink-0">
          <img src="https://ui-avatars.com/api/?name=Admin+GrowwStacks&background=b83a25&color=fff" alt="avatar" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm text-black hover:text-blue-700 hover:underline cursor-pointer">Admin GrowwStacks</span>
            <span className="text-xs text-black/60 font-normal">· 1st</span>
          </div>
          <div className="text-xs text-black/60 truncate">Content Creator at GrowwStacks</div>
          <div className="text-[11px] text-black/60 flex items-center gap-1 mt-0.5">
            <span>Just now</span>
            <span>·</span>
            <svg viewBox="0 0 16 16" className="h-3 w-3 inline" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM2.83 8a5.17 5.17 0 1110.34 0 5.17 5.17 0 01-10.34 0z" />
            </svg>
          </div>
        </div>
        <button className="text-black/60 hover:bg-black/5 p-1 rounded-full">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M19 12a2 2 0 11-4 0 2 2 0 014 0zM12 12a2 2 0 11-4 0 2 2 0 014 0zM5 12a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        </button>
      </div>

      {/* Post Content */}
      <div className="px-3 pb-2">
        <p className="text-sm text-black/90 whitespace-pre-wrap leading-relaxed">
          {caption}
        </p>
      </div>

      {/* Post Image Container */}
      <div className="bg-cream-100 min-h-[300px] relative group">
        {image ? (
          <>
            <img
              src={image}
              alt=""
              className="w-full h-auto block animate-fade-in"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setIdx(p => (p > 0 ? p - 1 : images.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button
                  onClick={() => setIdx(p => (p < images.length - 1 ? p + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6" /></svg>
                </button>
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-[10px] text-white font-medium">
                  {idx + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center text-ink-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            <span className="text-xs font-medium italic">Wait while AI crafting your visual...</span>
          </div>
        )}
      </div>

      {/* Social Stats */}
      <div className="px-3 py-2 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex -space-x-1">
            <span className="h-4 w-4 rounded-full bg-blue-500 border border-white flex items-center justify-center text-[8px] text-white">👍</span>
            <span className="h-4 w-4 rounded-full bg-red-400 border border-white flex items-center justify-center text-[8px] text-white">❤️</span>
          </div>
          <span className="text-[11px] text-black/60 ml-2">You and 12 others</span>
        </div>
        <div className="text-[11px] text-black/60 hover:text-blue-700 hover:underline cursor-pointer">4 comments</div>
      </div>

      {/* Action Bar */}
      <div className="px-1 py-1 flex items-center justify-around">
        <SocialBtn icon="👍" label="Like" />
        <SocialBtn icon="💬" label="Comment" />
        <SocialBtn icon="🔁" label="Repost" />
        <SocialBtn icon="📤" label="Send" />
      </div>
    </div>
  );
}

function SocialBtn({ icon, label }) {
  return (
    <button className="flex items-center gap-2 px-3 py-2 hover:bg-black/5 rounded font-semibold text-black/60 text-sm transition-colors">
      <span className="text-lg grayscale">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
