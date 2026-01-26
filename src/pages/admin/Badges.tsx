import { BadgesOverview } from '@/components/gamification';

export default function BadgesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Badges & Milestones</h1>
        <p className="text-muted-foreground">
          Bekijk je verdiende badges en volg je voortgang
        </p>
      </div>

      <BadgesOverview />
    </div>
  );
}
