# Ride Sprint 3D Printer Manager — Pro Guide

Welcome to the professional-grade fleet management and cost optimization tool. This software is designed to provide 99.9% cost accuracy for small businesses and hobbyist print farms.

---

## ⚡ Quick Start Flow

To get the most out of the manager, follow these three steps in order:

### 1. Configure Your Brand (Settings)
Before entering any projects, set up your professional identity. 
- **Navigate to**: `SETTINGS` (bottom of sidebar).
- **Brand Details**: Enter your Business Name, Slogan, and Contact Info.
- **Identity**: Upload your company logo (Square PNG recommended).
- **Currency**: Set your Global Site Currency. This will instantly update all history, invoices, and reports across the entire system.
- **Why?**: This information is used to brand your PDF invoices and system header.

### 2. Register Your Fleet (Printer Health)
Track your hardware wear-and-tear and automatically bill for depreciation.
- **Navigate to**: `PRINTER HEALTH`.
- **Add Printer**: Enter your printer's name and original purchase price.
- **Operational Life**: Set the estimated life (e.g., 5000 hours).
- **Maintenance Thresholds**: Set a warning level (e.g., 100 hrs) to be notified when service is due.
- **Why?**: The system automatically deducts print hours from assigned printers when you save a project, keeping you informed of maintenance windows.

### 3. Estimate & Save (New Project)
Now you're ready to calculate costs and manage orders.
- **Navigate to**: `NEW PROJECT`.
- **Material**: Enter price per KG spool. The system accounts for net weight + supports + waste %.
- **Power**: Enter your printer's average wattage and your local grid rate.
- **Labor**: Set your "Tech Rate" for the time you spend on setup and post-processing.
- **Results**: Watch the **DATA OUTPUT** panel update live as you change values.
- **Save**: Saving a project adds it to your History and deducts hours from your assigned printer.

---

## 🛠 Features

- **Cyberpunk UI**: High-contrast neon theme optimized for focused work.
- **Live Cost Analysis**: Real-time breakdown of Material, Power, Hardware, Labor, and Market risks.
- **Invoice Module**: Generate professional, branded PDF invoices with one click.
- **Project History**: Secure local storage of all past jobs with CSV export capabilities.
- **Local SQLite Persistence**: No cloud required—your business data stays on your machine.

## 🚀 Running the App

1. Ensure [Node.js](https://nodejs.org/) is installed.
2. Double-click **`run_calculator.bat`**.
3. The app will open at `http://localhost:3003`.

---

*Professional 3D Printing starts with precise estimation.*
