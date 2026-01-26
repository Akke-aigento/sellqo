import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import type { Achievement } from '@/lib/healthScoreCalculator';

interface HealthAchievementsProps {
  achievements: Achievement[];
}

export function HealthAchievements({ achievements }: HealthAchievementsProps) {
  if (achievements.length === 0) {
    return null;
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Prestaties deze week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <span className="text-xl">{achievement.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm">{achievement.title}</span>
              </div>
              {achievement.value && (
                <span className="text-sm font-medium text-primary">
                  {achievement.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
