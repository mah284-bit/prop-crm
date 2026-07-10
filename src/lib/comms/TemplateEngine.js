// Template variable substitution engine
export const TEMPLATE_VARIABLES = {
  lead: ["first_name", "last_name", "email", "phone", "budget", "timeline"],
  property: ["project_name", "unit_name", "unit_type", "size_sqft", "asking_price", "location"],
  broker: ["broker_name", "broker_email", "broker_phone", "company_name"],
  custom: ["buyer_name", "visit_date", "visit_time", "discount_pct"]
};

export const renderTemplate = (template, data = {}) => {
  try {
    let rendered = template;
    
    // Find all {{variable}} patterns
    const varPattern = /\{\{([^}]+)\}\}/g;
    const matches = rendered.match(varPattern) || [];
    
    // Replace each variable with data value
    matches.forEach(match => {
      const varName = match.replace(/[{}]/g, "").trim();
      const value = data[varName];
      
      if (value !== undefined && value !== null) {
        rendered = rendered.replace(match, value);
      } else {
        // Leave unreplaced if no data
        console.warn(`Variable not found: ${varName}`);
      }
    });
    
    return rendered;
  } catch (err) {
    console.error("Template render error:", err);
    return template;
  }
};

export const validateTemplate = (template, requiredVariables = []) => {
  const missing = [];
  requiredVariables.forEach(varName => {
    if (!template.includes(`{{${varName}}}`)) {
      missing.push(varName);
    }
  });
  return missing.length === 0 ? { valid: true } : { valid: false, missing };
};

export const extractVariables = (template) => {
  const varPattern = /\{\{([^}]+)\}\}/g;
  const vars = [];
  let match;
  while ((match = varPattern.exec(template)) !== null) {
    vars.push(match[1].trim());
  }
  return [...new Set(vars)];
};
