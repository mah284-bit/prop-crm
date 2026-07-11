export const EMAIL_TEMPLATES = {
  investor_new_launch: {name:"Investor: New Launch",subject:"New Investment Opportunity in {{project_name}}",body:"Hi {{buyer_name}},\n\nNew project from {{developer_name}} in {{location}}.\n\nProject: {{project_name}}\nStarting: {{starting_price}}\nROI: {{expected_roi}}%\n\nValid until {{early_bird_date}}.\n\nBest,\n{{broker_name}}",variables:["buyer_name","project_name","developer_name","location","starting_price","expected_roi","early_bird_date","broker_name"]},
  owner_proposal: {name:"Owner: Proposal Sent",subject:"Your Proposal - {{unit_ref}}",body:"Hi {{buyer_name}},\n\nProposal for {{unit_ref}} at {{project_name}}.\n\nPrice: AED {{price}}\nPayment: {{payment_plan}}\nValid: {{expiry_date}}\n\nLet me know!\n{{broker_name}}\n{{broker_phone}}",variables:["buyer_name","unit_ref","project_name","price","payment_plan","expiry_date","broker_name","broker_phone"]},
  site_visit: {name:"Site Visit Invite",subject:"Visit {{unit_ref}} - {{visit_date}}",body:"Hi {{buyer_name}},\n\nVisit {{unit_ref}} at {{project_name}}.\n\nDate: {{visit_date}} {{visit_time}}\nLocation: {{address}}\n\nConfirm by {{confirm_by_date}}.\n{{broker_name}}",variables:["buyer_name","unit_ref","project_name","visit_date","visit_time","address","confirm_by_date","broker_name"]},
  closed_won: {name:"Congratulations!",subject:"Your Purchase - {{unit_ref}}",body:"Hi {{buyer_name}},\n\nCongrats on {{unit_ref}}!\n\nPrice: AED {{final_price}}\nHandover: {{handover_date}}\n\nNext: SPA signing.\n{{broker_name}}",variables:["buyer_name","unit_ref","final_price","handover_date","broker_name"]}
};

export function getTemplate(id) { return EMAIL_TEMPLATES[id]; }

export function substituteVars(text, values) {
  Object.entries(values).forEach(([k,v]) => text = text.replace(new RegExp(`{{${k}}}`, 'g'), v||'—'));
  return text;
}
