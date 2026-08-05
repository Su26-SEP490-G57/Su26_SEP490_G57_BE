// The AddClinicalAssessmentFoundation migration bootstraps a single ACTIVE
// questionnaire_versions row (version_number 1) and no application workflow
// for authoring/publishing further versions exists yet. Until that lands,
// every question the app creates belongs to this bootstrap version.
export const DEFAULT_QUESTIONNAIRE_VERSION_ID = 1;
