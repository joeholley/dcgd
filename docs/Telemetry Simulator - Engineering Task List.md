# **Telemetry Simulator \- Engineering Task List**

## **1\. UI & Client Mock Enhancements**

* Active Player Cohort Selection: Remove user prefixes. Display only the cohort name and lifetime value. Retain a mock player name in the bottom-left client view card.  
* Client Mock Theme Update: Rebrand "Cosmic Raider RPG" to a fantasy theme, and change "Raid Dungeon Level 85" to "Tutorial Level 8 of 10".  
* Client Mock Frame: Clearly label the bottom-left client view as a "Mock Game Client" and style it visually to resemble a smartphone screen.

## **2\. Data Tracking & State Management**

* Initial State & Cohort Tracking: Ensure wipeouts, deaths, and exit intent counts initialize at zero upon application startup. Track these metrics dynamically per selected cohort.  
* Reset Controls: Add a button for each selectable cohort to reset their respective deaths and quits counters.

## **3\. Header & Navigation Updates**

* Dynamic Cohort Icons: Update the top status bar to reflect the specific icon of the currently selected cohort (currently hardcoded to the whale cohort's crown).  
* Navigation Clean-up: Remove placeholder text "Tab 1" and "Tab 2" from the top navigation bar.

## **4\. Concurrency & Anomaly Controls**

* Feature Stubs: Mark "Level 2 Bottleneck" and "Toxic Chat Outbreak" as "Not Yet Implemented" within the controls card while keeping the entries visible.  
* CCU Slider Scaling: Adjust the operator concurrency slider range to scale from 0 to 1,000,000. Rename "Synchronized Peak Target CCU" to "Simulated Global PCCU".

## **5\. Telemetry Logs & Routing**

* Conditional GCP Links: Hide the "Open in GCP Console" link for individual log entries when the "Mocked In-Memory" data routing mode is active.  
* Log Auto-Scroll & Clear: Add a button next to the trash can (styled as an up arrow pointing to a line) that toggles an auto-jump to the latest log entry at the top of the card. Transfer the current live view stream button functionality to this control.  
* Live Stream Pause Refactor: Repurpose the stream on/off toggle to entirely halt incoming events from writing to the log, rather than just pausing the visual view.

## **6\. Color Coordination & Visualization**

* In-Memory Routing Theme: Set the UI theme color for "Mocked In-Memory" mode to orange. Ensure this color updates in both the data routing selector and the top platform simulator control bar.  
* Data Channel Labeling: In-memory telemetry log entries must display "Outgoing" with an arrow pointing to the broadcast channel. Style this UI element with the matching orange theme color.  
* Concurrency Graph Conflicts: Ensure the "North America" chip color on the interactive 24-hour concurrency graph does not overlap with the new in-memory orange theme; reassign a different color if necessary.  
* Graph Renaming: Change the component title "Interactive 24-Hour Diurnal Concurrency Model" to "Interactive 24-Hour Simulated Concurrency Graph".