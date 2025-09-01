#!/usr/bin/env python3
import csv
import re
import os

def is_valid_name(name):
    """Check if name contains only letters (a-z, A-Z) and is not empty"""
    if not name or not name.strip():
        return False
    return re.match(r'^[a-zA-Z\s]+$', name.strip())

def process_csv_file(file_path, gmail_records, yahoo_records):
    """Process a CSV file and extract Gmail and Yahoo records with valid names"""
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found")
        return
    
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
        # Detect if first row has headers
        first_line = file.readline().strip()
        file.seek(0)
        
        reader = csv.reader(file)
        
        # Skip header if it looks like headers
        if 'first_name' in first_line.lower() or 'email' in first_line.lower():
            next(reader, None)
        
        for row in reader:
            if len(row) < 3:
                continue
                
            first_name = row[0].strip() if row[0] else ""
            last_name = row[1].strip() if row[1] else ""
            email = row[2].strip() if row[2] else ""
            
            # Check if names are valid (not empty and contain only letters)
            if (is_valid_name(first_name) and is_valid_name(last_name)):
                
                # Check for Gmail
                if '@gmail' in email.lower():
                    gmail_records.append([first_name, last_name, email])
                    print(f"Gmail Added: {first_name} {last_name} - {email}")
                
                # Check for Yahoo
                elif '@yahoo.com' in email.lower():
                    yahoo_records.append([first_name, last_name, email])
                    print(f"Yahoo Added: {first_name} {last_name} - {email}")

def main():
    base_path = "/Users/sscott/tbp/emails"
    
    # Lists to store all valid records
    gmail_records = []
    yahoo_records = []
    
    # Process both files
    print("Processing email-list1.csv...")
    process_csv_file(os.path.join(base_path, "email-list1.csv"), gmail_records, yahoo_records)
    
    print("Processing email-list2.csv...")  
    process_csv_file(os.path.join(base_path, "email-list2.csv"), gmail_records, yahoo_records)
    
    # Write to google.csv
    gmail_output_file = os.path.join(base_path, "google.csv")
    with open(gmail_output_file, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        # Write header
        writer.writerow(['first_name', 'last_name', 'email'])
        # Write all Gmail records
        writer.writerows(gmail_records)
    
    # Write to yahoo.csv
    yahoo_output_file = os.path.join(base_path, "yahoo.csv")
    with open(yahoo_output_file, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        # Write header
        writer.writerow(['first_name', 'last_name', 'email'])
        # Write all Yahoo records
        writer.writerows(yahoo_records)
    
    print(f"\nTotal Gmail records extracted: {len(gmail_records)}")
    print(f"Gmail results saved to: {gmail_output_file}")
    print(f"\nTotal Yahoo records extracted: {len(yahoo_records)}")
    print(f"Yahoo results saved to: {yahoo_output_file}")

if __name__ == "__main__":
    main()