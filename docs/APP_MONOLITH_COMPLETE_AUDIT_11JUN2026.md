# Complete App.jsx Monolith Audit (11 June 2026)

## THE PROBLEM
- 40 component functions live inside App.jsx (~17,300 lines)
- Separate component files in src/components/ may duplicate some
- Impossible to know which is active without detective work
- Result: 5+ days wasted editing orphaned files

## PART 1: FUNCTIONS IN App.jsx

- Line 281: function PermSetSelector({ companyId, value, onChange }) {
- Line 596: function LoginScreen({onLogin}){
- Line 729: function PropertyMaster({currentUser,showToast}){
- Line 1095: function OutcomeModal({activity, onClose, onSave}){
- Line 1144: function ActivitiesList({activities, setActivities, opp, canEdit, showToast, isLeasing=false, currentStage=null, units=[], onCaptureVisitOutcome=null}){
- Line 1616: function StageCaptureDialog({ open, opp, lead, fromStage, toStage, currentUser, onSave, onCancel, showToast, units = [], projects = [], salePricing = [] }) {
- Line 2324: function RemindersBell({ currentUser, onNavigateToOpp, onNavigateToLead, showToast }) {
- Line 2900: function OpenItemsGuard({ opp, lead, activities, units, projects, currentUser, onAllClosed, onCancel, onCaptureVisit, showToast, refreshActivities }) {
- Line 3083: function ProposalViewerDialog({ proposal, opp, lead, units, projects, currentUser, onClose, showToast }) {
- Line 3285: function ProposalBuilderDialog({ opp, lead, units, projects, salePricing, currentUser, lastProposal, onClose, onSaved, showToast }) {
- Line 4402: function NegotiationRoundDialog({ opp, lead, currentUser, lastRound, onClose, onSaved, showToast }) {
- Line 4608: function HandoverMeetingDialog({ opp, lead, currentUser, onClose, onSaved, showToast }) {
- Line 4732: function VisitOutcomeDialog({ visitActivity, opp, lead, units, projects, currentUser, onClose, onSaved, showToast }) {
- Line 4972: function OpportunityDetail({ opp, lead, units, projects, salePricing, users, currentUser, showToast, onBack, onUpdated }) {
- Line 9820: function CreateOpportunityDialog({ leads, setLeads, units, projects, salePricing, users, currentUser, showToast, onClose, onCreated, prefilledLead = null }) {
- Line 10888: function OpportunitiesPlaceholder({ currentUser, crmContext }) {
- Line 10905: function Opportunities({ leads, setLeads, opps, setOpps, units, projects, salePricing, activities, setActivities, currentUser, users, showToast, initialFilter=null }) {
- Line 11214: function Leads({leads,setLeads,opps
- Line 12190: function Dashboard({leads,opps=[],properties,activities,currentUser,meetings=[],followups=[],crmContext="sales",units=[],salePricing=[],leasePricing=[],leases=[],users=[],onNavigate=()=>{}}){
- Line 12434: function CoachPage({ opps, leads, activities, users, currentUser, showToast, onNavigateToOpp }) {
- Line 12736: function LogActivityModal({lead, opp, currentUser, showToast, onClose, onSaved, defaultType="Call"}) {
- Line 12899: function Pipeline({leads, opps, setOpps, users, currentUser, showToast, activities=[]}) {
- Line 13223: function ActivityLog({leads,activities,setActivities,currentUser,showToast,initialFilter=null}){
- Line 13307: function GroupConsolidatedView() {
- Line 13431: function ProjectsModule({ currentUser, showToast, crmContext="sales", preloadedProjects=null, preloadedUnits=null }) {
- Line 13769: function ReservationBadge({ reservation }) {
- Line 13786: function ReservationModal({ unit, reservation, currentUser, leads=[], tenants=[], opportunities=[], showToast, onClose, onSaved, unitHasPrice=true, unitLaunchDate=null }) {
- Line 14097: function ReservationsWidget({ currentUser, units=[], onManage }) {
- Line 14217: function DiscountApprovals({discounts,setDiscounts,leads,user,toast}) {
- Line 14364: function LeasingChequeManager({ lease, tenantName, unitLabel, currentUser, showToast }) {
- Line 14692: function PaymentPlanTemplates({ currentUser, showToast, projects=[], onSelectPlan }) {
- Line 14914: function AIAssistant({leads,units,projects,salePricing,leasePricing,activities,currentUser,showToast}){
- Line 15244: function SetupWizard({ onComplete }) {
- Line 15479: function LeasingDashboard({currentUser, activities=[], units=[], salePricing=[], leasePricing=[], leasingData=null, onNavigate=()=>{}, followupAlerts={}}) {
- Line 15774: function UserManagement({currentUser, leads=[], activities=[], showToast, appConfig={}, onConfigChange=()=>{}}) {
- Line 15792: function UsersTab({currentUser, showToast}) {
- Line 15993: function SettingsTab({appConfig, onConfigChange, currentUser, showToast}) {
- Line 16029: function CompaniesModule({ currentUser, showToast, onSwitchCompany, activeCompanyId }) {
- Line 16391: function PermissionSetsModule({ currentUser, showToast }) {
- Line 16746: function PwRecoveryForm({onDone}){

## PART 2: COMPONENT FILES (src/components/)

- src/components/ActivityLog.jsx
- src/components/CommissionOutstanding.jsx
- src/components/CompaniesModule.jsx
- src/components/CountryPicker.jsx
- src/components/Dashboard.jsx
- src/components/DiscountApprovals.jsx
- src/components/InventoryModule.jsx
- src/components/LeadCreationFormV2.jsx
- src/components/LeadPeopleSection.jsx
- src/components/LeadPersonEditModal.jsx
- src/components/Leads.jsx
- src/components/LeaseOpportunityDetail.jsx
- src/components/LeasingDashboard.jsx
- src/components/LeasingLeads.jsx
- src/components/LeasingModule.jsx
- src/components/MasterAgreements.jsx
- src/components/OpportunityDetail.jsx
- src/components/PermissionSetsModule.jsx
- src/components/PropPulse.jsx
- src/components/ReportsModule.jsx
- src/components/UnitPickerRich.jsx
- src/components/UnitSearchPicker.jsx
- src/components/UserManagement.jsx
- src/components/customers/CustomersPage.jsx
- src/components/leadqueue/AssignPoolDropdown.jsx
- src/components/leadqueue/LeadQueuePage.jsx
- src/components/leadqueue/ReassignDialog.jsx
- src/components/leadqueue/ReleaseDialog.jsx
- src/components/property/AmenityGrid.jsx
- src/components/property/FullImage.jsx
- src/components/property/MediaGallery.jsx
- src/components/property/PdfPreview.jsx
- src/components/property/PropertyPackModal.jsx
- src/components/property/PropertyPackPDF.jsx
- src/components/property/PropertyPackShareModal.jsx
- src/components/property/VideoEmbed.jsx
- src/components/settings/AgentPoolsSection.jsx
- src/components/settings/GroupBranchesSection.jsx
- src/components/settings/LeadRoutingRulesSection.jsx
- src/components/settings/PoolEditModal.jsx
- src/components/settings/SettingsPage.jsx

## PART 3: KNOWN DUPLICATES (So Far)

### Leads Component
- **App.jsx function:** Line 11214 `function Leads(...)`
- **Separate file:** `src/components/Leads.jsx` (394 lines)
- **Status:** DUPLICATE
- **Active:** App.jsx version (rendered at line 17227)
- **Orphaned:** src/components/Leads.jsx (not imported anywhere)
- **Action:** DELETE src/components/Leads.jsx

## PART 4: AUDIT TEMPLATE (Apply to all 40 functions)

For each function, mark:
- [ ] **USED** — actively rendered in a tab
- [ ] **UNUSED** — defined but never rendered
- [ ] **DUPLICATE** — also exists as separate file
- [ ] **SCATTERED** — state/logic spread across App.jsx + separate file

---

## NEXT STEPS
1. Complete audit (mark all 40)
2. List all orphaned files to delete
3. Identify scattered patterns
4. Create safe refactor roadmap
5. Execute with git checkpoints

---

AUDIT IN PROGRESS: [11 June 2026, Day 33]
