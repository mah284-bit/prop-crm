# App.jsx Monolith Audit (11 June 2026)

## SUMMARY
- **Total functions in App.jsx:** 40
- **Status:** UNKNOWN which are used vs orphaned
- **Risk:** Refactoring without this audit could break production

## STEP 1: FUNCTION INVENTORY

Run this to list all functions:
281:function PermSetSelector({ companyId, value, onChange }) {
596:function LoginScreen({onLogin}){
729:function PropertyMaster({currentUser,showToast}){
1095:function OutcomeModal({activity, onClose, onSave}){
1144:function ActivitiesList({activities, setActivities, opp, canEdit, showToast, isLeasing=false, currentStage=null, units=[], onCaptureVisitOutcome=null}){
1616:function StageCaptureDialog({ open, opp, lead, fromStage, toStage, currentUser, onSave, onCancel, showToast, units = [], projects = [], salePricing = [] }) {
2324:function RemindersBell({ currentUser, onNavigateToOpp, onNavigateToLead, showToast }) {
2900:function OpenItemsGuard({ opp, lead, activities, units, projects, currentUser, onAllClosed, onCancel, onCaptureVisit, showToast, refreshActivities }) {
3083:function ProposalViewerDialog({ proposal, opp, lead, units, projects, currentUser, onClose, showToast }) {
3285:function ProposalBuilderDialog({ opp, lead, units, projects, salePricing, currentUser, lastProposal, onClose, onSaved, showToast }) {
4402:function NegotiationRoundDialog({ opp, lead, currentUser, lastRound, onClose, onSaved, showToast }) {
4608:function HandoverMeetingDialog({ opp, lead, currentUser, onClose, onSaved, showToast }) {
4732:function VisitOutcomeDialog({ visitActivity, opp, lead, units, projects, currentUser, onClose, onSaved, showToast }) {
4972:function OpportunityDetail({ opp, lead, units, projects, salePricing, users, currentUser, showToast, onBack, onUpdated }) {
9820:function CreateOpportunityDialog({ leads, setLeads, units, projects, salePricing, users, currentUser, showToast, onClose, onCreated, prefilledLead = null }) {
10888:function OpportunitiesPlaceholder({ currentUser, crmContext }) {
10905:function Opportunities({ leads, setLeads, opps, setOpps, units, projects, salePricing, activities, setActivities, currentUser, users, showToast, initialFilter=null }) {
11214:function Leads({leads,setLeads,opps:globalOppsFromParent=[],setOpps:setGlobalOpps=()=>{},properties,activities,setActivities,discounts,setDiscounts,currentUser,users,showToast,initialFilter=null,onNavigateToOpp=null,refCountries=[],refRules={}}){
12190:function Dashboard({leads,opps=[],properties,activities,currentUser,meetings=[],followups=[],crmContext="sales",units=[],salePricing=[],leasePricing=[],leases=[],users=[],onNavigate=()=>{}}){
12434:function CoachPage({ opps, leads, activities, users, currentUser, showToast, onNavigateToOpp }) {
12736:function LogActivityModal({lead, opp, currentUser, showToast, onClose, onSaved, defaultType="Call"}) {
12899:function Pipeline({leads, opps, setOpps, users, currentUser, showToast, activities=[]}) {
13223:function ActivityLog({leads,activities,setActivities,currentUser,showToast,initialFilter=null}){
13307:function GroupConsolidatedView() {
13431:function ProjectsModule({ currentUser, showToast, crmContext="sales", preloadedProjects=null, preloadedUnits=null }) {
13769:function ReservationBadge({ reservation }) {
13786:function ReservationModal({ unit, reservation, currentUser, leads=[], tenants=[], opportunities=[], showToast, onClose, onSaved, unitHasPrice=true, unitLaunchDate=null }) {
14097:function ReservationsWidget({ currentUser, units=[], onManage }) {
14217:function DiscountApprovals({discounts,setDiscounts,leads,user,toast}) {
14364:function LeasingChequeManager({ lease, tenantName, unitLabel, currentUser, showToast }) {
14692:function PaymentPlanTemplates({ currentUser, showToast, projects=[], onSelectPlan }) {
14914:function AIAssistant({leads,units,projects,salePricing,leasePricing,activities,currentUser,showToast}){
15244:function SetupWizard({ onComplete }) {
15479:function LeasingDashboard({currentUser, activities=[], units=[], salePricing=[], leasePricing=[], leasingData=null, onNavigate=()=>{}, followupAlerts={}}) {
15774:function UserManagement({currentUser, leads=[], activities=[], showToast, appConfig={}, onConfigChange=()=>{}}) {
15792:function UsersTab({currentUser, showToast}) {
15993:function SettingsTab({appConfig, onConfigChange, currentUser, showToast}) {
16029:function CompaniesModule({ currentUser, showToast, onSwitchCompany, activeCompanyId }) {
16391:function PermissionSetsModule({ currentUser, showToast }) {
16746:function PwRecoveryForm({onDone}){

## STEP 2: ORPHANED FILES INVENTORY

Files in src/components/ that may be duplicates:
src/components/ActivityLog.jsx
src/components/CommissionOutstanding.jsx
src/components/CompaniesModule.jsx
src/components/CountryPicker.jsx
src/components/Dashboard.jsx
src/components/DiscountApprovals.jsx
src/components/InventoryModule.jsx
src/components/LeadCreationFormV2.jsx
src/components/LeadPeopleSection.jsx
src/components/LeadPersonEditModal.jsx
src/components/Leads.jsx
src/components/LeaseOpportunityDetail.jsx
src/components/LeasingDashboard.jsx
src/components/LeasingLeads.jsx
src/components/LeasingModule.jsx
src/components/MasterAgreements.jsx
src/components/OpportunityDetail.jsx
src/components/PermissionSetsModule.jsx
src/components/PropPulse.jsx
src/components/ReportsModule.jsx
src/components/UnitPickerRich.jsx
src/components/UnitSearchPicker.jsx
src/components/UserManagement.jsx
src/components/customers/CustomersPage.jsx
src/components/leadqueue/AssignPoolDropdown.jsx
src/components/leadqueue/LeadQueuePage.jsx
src/components/leadqueue/ReassignDialog.jsx
src/components/leadqueue/ReleaseDialog.jsx
src/components/property/AmenityGrid.jsx
src/components/property/FullImage.jsx
src/components/property/MediaGallery.jsx
src/components/property/PdfPreview.jsx
src/components/property/PropertyPackModal.jsx
src/components/property/PropertyPackPDF.jsx
src/components/property/PropertyPackShareModal.jsx
src/components/property/VideoEmbed.jsx
src/components/settings/AgentPoolsSection.jsx
src/components/settings/GroupBranchesSection.jsx
src/components/settings/LeadRoutingRulesSection.jsx
src/components/settings/PoolEditModal.jsx
src/components/settings/SettingsPage.jsx

## STEP 3: ACTUAL USAGE

Check which functions are actually rendered:
- grep tab=== src/App.jsx (shows active nav tabs)
- grep <FunctionName src/App.jsx (shows render calls)

## STEP 4: DECISION MATRIX

For each function in App.jsx:
[ ] Used (rendered in tab) → KEEP in App.jsx
[ ] Unused (no render) → MOVE to src/components/FunctionName.jsx
[ ] Duplicate (also in separate file) → DELETE one, use the other

## EXAMPLE: Leads
- Function at line 11214 in App.jsx → USED (rendered at line 17227)
- File at src/components/Leads.jsx (394 lines) → ORPHANED (not imported)
→ Decision: DELETE src/components/Leads.jsx, keep App.jsx version

## NEXT STEPS
1. Complete full audit (mark each of 40 functions)
2. Identify all orphaned files
3. Create refactor plan with zero-risk steps
4. Execute with git checkpoints

---
