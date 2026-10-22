import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Auth UI 2x2 Matrix & Persona Footer Toggles Contract', () => {
  const authCanvasContent = fs.readFileSync(
    path.resolve(__dirname, '../components/auth/AuthCanvas.tsx'),
    'utf-8'
  );
  const loginFormContent = fs.readFileSync(
    path.resolve(__dirname, '../components/auth/LoginForm.tsx'),
    'utf-8'
  );
  const signUpWizardContent = fs.readFileSync(
    path.resolve(__dirname, '../components/auth/SignUpWizard.tsx'),
    'utf-8'
  );

  it('Consolidates Top-Level Action Tabs in AuthCanvas with exactly ONE toggle for isSignUp', () => {
    // AuthCanvas maintains single source of truth for isSignUp
    expect(authCanvasContent).toContain('setIsSignUp(false)');
    expect(authCanvasContent).toContain('setIsSignUp(true)');
    expect(authCanvasContent).toContain('Consolidated Top-Level Action Tabs: Controls exactly isSignUp');

    // Exactly one set of toggle buttons for Sign In / Create Account
    expect(authCanvasContent).toContain('Sign In');
    expect(authCanvasContent).toContain('Create Account');
  });

  it('Removes all duplicate and nested tabs inside LoginForm', () => {
    // Duplicate tabs like adminTab or inner toggle switchers must NOT exist
    expect(loginFormContent).not.toContain('setAdminTab');
    expect(loginFormContent).not.toContain("adminTab === 'signin'");
    expect(loginFormContent).not.toContain("adminTab === 'signup'");
    expect(loginFormContent).not.toContain('Admin Mode: Seamless Tab Toggle');
  });

  it('Removes cluttered multi-link footers in LoginForm and implements exactly ONE persona toggle', () => {
    // Multi-links removed
    expect(loginFormContent).not.toContain('Need a faculty account?');
    expect(loginFormContent).not.toContain('Already have a faculty account?');
    expect(loginFormContent).not.toContain('Candidate looking for interviews?');
    expect(loginFormContent).not.toContain('New candidate?');
    expect(loginFormContent).not.toContain('Staff & Faculty Access');

    // Single persona toggle link exists with muted styling
    expect(loginFormContent).toContain('Persona Footer Toggle: Exactly ONE link that flips isStaff');
    expect(loginFormContent).toContain('text-stone-400');
    expect(loginFormContent).toContain('hover:text-stone-200');
    expect(loginFormContent).toContain('onClick={onToggleStaff}');
  });

  it('State 1: Candidate Sign In (isSignUp: false, isStaff: false)', () => {
    // Title: "Welcome back, Candidate"
    expect(loginFormContent).toContain("'Welcome back, Candidate'");
    // Submit button: "Sign In"
    expect(loginFormContent).toContain("isStaff ? 'Sign in to Portal' : 'Sign In'");
    // Footer link text: "Staff Sign In →"
    expect(loginFormContent).toContain("!isSignUp && !isStaff && 'Staff Sign In →'");
  });

  it('State 2: Staff Sign In (isSignUp: false, isStaff: true)', () => {
    // Title: "Faculty & Admin Portal"
    expect(loginFormContent).toContain("'Faculty & Admin Portal'");
    // Submit button: "Sign in to Portal"
    expect(loginFormContent).toContain("isStaff ? 'Sign in to Portal' : 'Sign In'");
    // Footer link text: "Candidate Sign In →"
    expect(loginFormContent).toContain("!isSignUp && isStaff && 'Candidate Sign In →'");
  });

  it('State 3: Candidate Sign Up (isSignUp: true, isStaff: false)', () => {
    // Title: "Create Candidate Account"
    expect(signUpWizardContent).toContain('Create Candidate Account');
    // Submit button in Step 2: "Create Account"
    expect(signUpWizardContent).toContain('<span>Create Account</span>');
    // Footer link text: "Create Staff Account →"
    expect(signUpWizardContent).toContain('Create Staff Account &rarr;');
    expect(signUpWizardContent).toContain('onClick={onToggleStaff}');
    expect(signUpWizardContent).toContain('text-stone-400 hover:text-stone-200');
  });

  it('State 4: Staff Sign Up (isSignUp: true, isStaff: true)', () => {
    // Title: "Create Staff Account"
    expect(loginFormContent).toContain("'Create Staff Account'");
    // Fields: Full Name, Institutional Email, Password, Faculty Authorization Code
    expect(loginFormContent).toContain('id="admin-name"');
    expect(loginFormContent).toContain('id="admin-email"');
    expect(loginFormContent).toContain('id="admin-password"');
    expect(loginFormContent).toContain('id="admin-code"');
    // Submit button: "Create Faculty Account"
    expect(loginFormContent).toContain('<span>Create Faculty Account</span>');
    // Footer link text: "Create Candidate Account →"
    expect(loginFormContent).toContain("isSignUp && isStaff && 'Create Candidate Account →'");
  });
});
