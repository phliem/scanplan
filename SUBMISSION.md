# Scanplan — DevDay Hack London submission pack

Prepared for 1 November 2026. Draft copy; not submitted.

## Form copy

**Team name:** Scanplan

**Team members:** Liem Pham (presenter), George McCarthy. Contact details belong in the private submission form.

**Project name:** Scanplan

**Tagline:** Plan the event. Walk the room before anyone arrives.

**Project description:**

Scanplan helps event organisers turn an empty venue into a space they can picture using. Inspired by a warehouse photograph, it brings the room into an editable 3D planner: set the dimensions, choose a hackathon or theatre layout, and rearrange tables, chairs, couches and refreshment stations. Compare different warehouse arrangements, add animated attendees, then take a cinematic tour through the doors and into your event. Layouts save locally, and you can bring your own GLB furniture models. Built with Codex, Scanplan makes event planning visual and playful before the first table is moved. This prototype uses estimated geometry; automatic room scanning is not implemented.

**Public GitHub repository:** https://github.com/phliem/Scanplan

**Branch containing the latest layout work:** https://github.com/phliem/Scanplan/tree/phliem/hackathon-lounge

**Presenter social link:** https://github.com/phliem (confirm presenter identity)

Do not use the existing sign-in-only ChatGPT Site as the required public video link. The app's **Video** control plays a live 3D animation; it does not create a recorded video file.

## Suggested 80-second product demo

Record the working app, with narration and no slides. Leave a little margin below the 90-second limit.

Before recording: open the app, use a 16 × 28 m room, select Hackathon and 150 attendees. Use the branch linked above for the comparison feature. Keep the browser at a readable desktop size. Avoid showing private browser tabs or personal information.

| Time | On screen | Suggested narration |
| --- | --- | --- |
| 0–10 s | Start on the warehouse in 3D; orbit briefly. | “This is Scanplan. Before you move a single table, see how your event could feel inside the room.” |
| 10–23 s | Show dimensions, then apply Hackathon for 150. | “Start with the venue dimensions and the event you're planning. Scanplan arranges the desks and chairs, with lounges and refreshment stations.” |
| 23–38 s | Open Compare relaxed layouts; try Creative pockets. | “A hackathon doesn't have to feel like an exam hall. Compare arrangements and try a more relaxed warehouse layout.” |
| 38–49 s | Move one table; rotate it; show undo. | “Every object stays editable. Move it, rotate it, or undo it. The floor plan and 3D view show the same layout.” |
| 49–61 s | Add 150 people in Sitting & walking mode. | “Add people to see the room come alive, with attendees sitting and walking around your furniture.” |
| 61–76 s | Play the venue film through the opening doors. | “Then walk through the doors and preview the event at eye level. Codex helped build the editor, layout generation, crowd preview and this animated tour.” |
| 76–80 s | End on the room with people. | “Scanplan: plan the event, then walk the room.” |

Only narrate controls and behaviour actually shown in the recording. If a step takes too long, drop the manual furniture edit before cutting the tour.

## Codex contribution — supporting copy

Codex helped implement and iterate on the Three.js venue, editable dimensions, furniture interactions, activity layouts, local GLB library, animated attendees, and the cinematic arrival tour. It also helped write automated checks for room boundaries, rotated furniture collisions, generated seating, model validation, crowd placement and tour paths. The organiser directed the visual and layout choices and reviewed successive versions.

Confirm the exact division of work and any other contributors before using this statement as the team's final account.

## Existing work and attribution

- Three.js 0.170.0, OrbitControls and GLTFLoader are existing MIT-licensed dependencies, vendored with their license in `dist/vendor/`.
- The venue is inspired by a supplied photograph. Its dimensions are estimates, and its geometry is not an automatic reconstruction. The source photograph and its people are not included in deployed assets.
- Built-in furniture geometry and textures are generated in code. User-imported GLB assets retain their own provenance and licensing; use only assets you have permission to show.
- The standalone repository's first commit is dated 1 November 2026 at 14:10 UTC. The README says the original source is preserved in Octo Devlabs. Commit dates alone do not establish when that source was created: the team must identify any earlier prototype or assets, and clearly state what was built during the event.
- No runtime AI API is required. Codex was used during development; free-text planning and room scanning are not implemented.

## Judge quick start

Use Node.js 22.13+ with Corepack available (Node 24 preferred):

```sh
git clone https://github.com/phliem/Scanplan.git
cd Scanplan
git switch phliem/hackathon-lounge
corepack pnpm dev
```

Open http://localhost:8108. No API key or dependency installation is required. Set the room to 16 × 28 m, select Hackathon → 150 → Apply activity layout, compare the relaxed layouts, add people, then select Video.

Verification on 1 November: `corepack pnpm test` passed all 41 tests in the local checkout. Concurrent work is still updating the tour, so rerun verification for the final submitted revision. Seating counts are template outputs, not certified venue capacity; the crowd is an illustrative preview.

## Required before submission

- Team name; each team member's name; presenter first.
- Presenter contact email and WhatsApp number. Keep private contact details in the submission form, not this public file.
- At least one presenter social link.
- Accurate statement of work built today versus pre-existing work.
- Public recording of the working product, at most 90 seconds, opening without an access request.
- Ensure the submitted README describes the submitted revision. The latest layout work is on the linked feature branch; merging requires the owner's separate instruction.

## Event requirements and sources

[Builders Guide](https://warp-peach-ef6.notion.site/) and [submission form](https://hack.outpostcrew.co/e/devday-hack-london-49b733), checked on 1 November 2026:

- Submit once per team by 17:00 London time.
- Build rules allow solo teams or up to four people. The form can display more member fields; follow the guide's four-person limit unless organisers explicitly changed it.
- Create the core project during the event, use Codex, and credit existing code/assets.
- Judges assess usefulness, use of Codex, execution, and demo clarity.
- Required: team name, project name and description, public GitHub repository, public product video up to 90 seconds, presenter name/email/WhatsApp and at least one social link.
- The form includes a declaration that the entry meets the rules and is accurate. The presenter should review this and the final entry before submitting.
