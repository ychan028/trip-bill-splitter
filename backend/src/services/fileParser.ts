import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import XLSX from 'xlsx';
import { Contact } from '../types/contact';

// Field mapping for CSV headers
const FIELD_MAPPINGS: { [key: string]: keyof Contact } = {
  'first name': 'firstName',
  'firstname': 'firstName',
  'last name': 'lastName',
  'lastname': 'lastName',
  'title': 'title',
  'job title': 'title',
  'seniority': 'seniority',
  'company': 'company',
  'company name': 'company',
  'company industries': 'companyIndustries',
  'industries': 'companyIndustries',
  'industry': 'companyIndustries',
  'assets': 'assets',
  'email': 'email',
  'email address': 'email',
  'phone number': 'phoneNumber',
  'phone': 'phoneNumber',
  'phone type': 'phoneType',
  'city': 'city',
  'state': 'state',
  'country': 'country'
};

function normalizeFieldName(field: string): keyof Contact | null {
  const normalized = field.toLowerCase().trim();
  return FIELD_MAPPINGS[normalized] || null;
}

function parseRow(row: any): Contact | null {
  const contact: Partial<Contact> = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeFieldName(key);
    if (normalizedKey) {
      contact[normalizedKey] = String(value || '').trim();
    }
  }

  // Validate required fields
  if (!contact.email || !contact.firstName || !contact.lastName) {
    return null;
  }

  return contact as Contact;
}

export async function parseContactsFile(filePath: string): Promise<Contact[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    return parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(filePath);
  } else {
    throw new Error('Unsupported file type');
  }
}

async function parseCSV(filePath: string): Promise<Contact[]> {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const contacts: Contact[] = [];

        for (const row of results.data) {
          const contact = parseRow(row);
          if (contact) {
            contacts.push(contact);
          }
        }

        if (contacts.length === 0) {
          reject(new Error('No valid contacts found in CSV file'));
        } else {
          resolve(contacts);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

async function parseExcel(filePath: string): Promise<Contact[]> {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const contacts: Contact[] = [];

    for (const row of data) {
      const contact = parseRow(row);
      if (contact) {
        contacts.push(contact);
      }
    }

    if (contacts.length === 0) {
      throw new Error('No valid contacts found in Excel file');
    }

    return contacts;
  } catch (error: any) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
}
