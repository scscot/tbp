#!/usr/bin/env python3
import csv
import os
from collections import defaultdict

def check_and_remove_duplicates(file_path):
    """Check for duplicate emails in CSV file and remove them"""
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found")
        return
    
    print(f"\nProcessing: {file_path}")
    
    # Read all records
    records = []
    email_counts = defaultdict(int)
    email_first_occurrence = {}
    
    with open(file_path, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader)  # Read header
        
        for row_num, row in enumerate(reader, start=2):
            if len(row) >= 3:
                first_name = row[0].strip()
                last_name = row[1].strip()
                email = row[2].strip().lower()  # Normalize email for comparison
                
                records.append([first_name, last_name, email])
                email_counts[email] += 1
                
                if email not in email_first_occurrence:
                    email_first_occurrence[email] = row_num
    
    # Find duplicates
    duplicates = {email: count for email, count in email_counts.items() if count > 1}
    
    if duplicates:
        print(f"Found {len(duplicates)} duplicate emails:")
        for email, count in sorted(duplicates.items()):
            print(f"  - {email} appears {count} times (first at row {email_first_occurrence[email]})")
    else:
        print("✅ No duplicate emails found")
        return records, 0
    
    # Remove duplicates (keep first occurrence)
    seen_emails = set()
    unique_records = []
    
    for record in records:
        email = record[2].lower()
        if email not in seen_emails:
            seen_emails.add(email)
            # Keep original case for email
            original_email = record[2]
            unique_records.append([record[0], record[1], original_email])
    
    # Write back to file
    with open(file_path, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(header)
        writer.writerows(unique_records)
    
    duplicates_removed = len(records) - len(unique_records)
    print(f"✅ Removed {duplicates_removed} duplicate records")
    print(f"✅ Final count: {len(unique_records)} unique emails")
    
    return unique_records, duplicates_removed

def main():
    base_path = "/Users/sscott/tbp/emails"
    
    print("🔍 DUPLICATE EMAIL CHECKER")
    print("=" * 50)
    
    # Check Google CSV
    google_file = os.path.join(base_path, "google.csv")
    google_records, google_dupes_removed = check_and_remove_duplicates(google_file)
    
    # Check Yahoo CSV  
    yahoo_file = os.path.join(base_path, "yahoo.csv")
    yahoo_records, yahoo_dupes_removed = check_and_remove_duplicates(yahoo_file)
    
    # Summary report
    print("\n" + "=" * 50)
    print("📊 SUMMARY REPORT")
    print("=" * 50)
    
    if google_records is not None:
        print(f"Google CSV: {len(google_records)} unique emails ({google_dupes_removed} duplicates removed)")
    
    if yahoo_records is not None:
        print(f"Yahoo CSV: {len(yahoo_records)} unique emails ({yahoo_dupes_removed} duplicates removed)")
    
    total_removed = (google_dupes_removed if google_dupes_removed else 0) + (yahoo_dupes_removed if yahoo_dupes_removed else 0)
    
    if total_removed > 0:
        print(f"\n🎉 Total duplicates removed: {total_removed}")
        print("✅ Files have been cleaned and updated")
    else:
        print("\n✅ All files are already clean - no duplicates found!")

if __name__ == "__main__":
    main()