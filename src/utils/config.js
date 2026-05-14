export const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID || 'appSm4fcQQwuLZ6CW';
export const AIRTABLE_TABLE_ID = import.meta.env.VITE_AIRTABLE_TABLE_ID || 'tblauEa6iYlkZ3Epy';
export const AIRTABLE_AUTH_TABLE = 'Credentials';
export const AIRTABLE_PAT = import.meta.env.VITE_AIRTABLE_PAT || '';
export const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || 'https://n8nadmin.1automation.us/webhook/5ef7f3a8-6c88-4aca-928a-4084ba46134a';

export const APP_NAME = 'LinkedIn Forge';

export const FIELDS = {
  eventName: '﻿Occasion / Event Name',
  date: 'Date',
  postType: 'Post Type',
  captionStyle: 'Caption Style',
  imagePrompt: 'Image Prompt',
  imageLinks: 'Image Links',
  captionDraft: 'Caption Draft',
  generatedImage: 'Generated Image URL',
  approvalStatus: 'Approval Status',
  published: 'Published',
  postDate: 'Post Date',
  linkedinUrl: 'LinkedIn Post URL',
  tagUrls: 'TagURLs',
  tagUrns: 'TagURNs',
  schedulingDate: 'Scheduling Date'
};

export const POST_TYPES = ['Observance', 'Event', 'Collage'];
export const CAPTION_STYLES = ['Engaging', 'Professional', 'Data-Driven', 'Conversational'];
export const APPROVAL_STATES = ['Pending', 'Approved', 'Rejected'];
export const PUBLISHED_STATES = ['Pending', 'Posted'];
