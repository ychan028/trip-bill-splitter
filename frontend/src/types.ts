export interface Contact {
  firstName: string;
  lastName: string;
  title: string;
  seniority: string;
  company: string;
  companyIndustries: string;
  assets: string;
  email: string;
  phoneNumber: string;
  phoneType: string;
  city: string;
  state: string;
  country: string;
}

export interface GeneratedEmail {
  contact: Contact;
  subjectLine: string;
  emailMessage: string;
}

export type Step = 'upload' | 'configure' | 'generate' | 'review';
