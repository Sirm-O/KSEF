import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { CompetitionLevel, Project, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { addCertificatePage } from '../components/reports/CertificateGenerator';
import jsPDF from 'jspdf';
import { Award, BookOpen, GraduationCap, School, ShieldCheck, Trophy } from 'lucide-react';

const LEVELS: CompetitionLevel[] = [
  CompetitionLevel.SUB_COUNTY,
  CompetitionLevel.COUNTY,
  CompetitionLevel.REGIONAL,
  CompetitionLevel.NATIONAL,
];

const CertificatesPage: React.FC = () => {
  const {
    user,
    users,
    projects,
    assignments,
    activeEdition,
    isEditionCompleted,
    calculateRankingsAndPointsForProjects,
  } = useContext(AppContext);

  const [level, setLevel] = useState<CompetitionLevel>(CompetitionLevel.SUB_COUNTY);

  const mySchool = user?.school || '';
  const isPatron = user?.currentRole === UserRole.PATRON;

  const isLevelPublished = useMemo(() => {
    if (!activeEdition) return false;
    if (level === CompetitionLevel.NATIONAL) {
      return isEditionCompleted || assignments.some(a => a.competitionLevel === level && a.isArchived);
    }
    return assignments.some(a => a.competitionLevel === level && a.isArchived);
  }, [assignments, isEditionCompleted, level, activeEdition]);

  const archivedProjectIdsAtLevel = useMemo(() => {
    const ids = new Set<string>();
    assignments
      .filter(a => a.competitionLevel === level && a.isArchived)
      .forEach(a => ids.add(a.projectId));
    return ids;
  }, [assignments, level]);

  const eligibleProjects: Project[] = useMemo(() => {
    const inLevel = projects.filter(p => archivedProjectIdsAtLevel.has(p.id));
    if (!user) return [];
    if (isPatron) {
      return inLevel.filter(p => p.school === mySchool);
    }
    switch (user.currentRole) {
      case UserRole.SUPER_ADMIN:
      case UserRole.NATIONAL_ADMIN:
        return inLevel;
      case UserRole.REGIONAL_ADMIN:
        return inLevel.filter(p => p.region === user.region);
      case UserRole.COUNTY_ADMIN:
        return inLevel.filter(p => p.region === user.region && p.county === user.county);
      case UserRole.SUB_COUNTY_ADMIN:
        return inLevel.filter(p => p.region === user.region && p.county === user.county && p.subCounty === user.subCounty);
      default:
        return [];
    }
  }, [projects, archivedProjectIdsAtLevel, isPatron, mySchool, user]);

  const nationalRankByProjectId = useMemo(() => {
    if (level !== CompetitionLevel.NATIONAL) return new Map<string, number>();
    const nationalProjects = projects.filter(p => archivedProjectIdsAtLevel.has(p.id));
    const ranking = calculateRankingsAndPointsForProjects(nationalProjects, CompetitionLevel.NATIONAL);
    const map = new Map<string, number>();
    ranking.projectsWithPoints.forEach(p => {
      if (p.categoryRank) map.set(p.id, p.categoryRank);
    });
    return map;
  }, [level, projects, archivedProjectIdsAtLevel, calculateRankingsAndPointsForProjects]);

  const ensurePublished = () => {
    if (!isLevelPublished) {
      throw new Error('Certificates will be available after publishing results for this level.');
    }
  };

  const addStudentPages = async (doc: jsPDF, project: Project) => {
    for (let i = 0; i < project.students.length; i++) {
      const studentName = project.students[i];
      let isWinner = false;
      let isParticipant = false;
      let award: string | undefined = undefined;
      if (level === CompetitionLevel.NATIONAL) {
        const rk = nationalRankByProjectId.get(project.id);
        if (rk && rk <= 3) { isWinner = true; award = `Position ${rk}`; }
        else { isParticipant = true; }
      }
      await addCertificatePage({
        doc,
        name: studentName,
        type: 'Student',
        projectTitle: project.title,
        school: project.school,
        levelFrom: level,
        levelTo: project.currentLevel,
        editionName: activeEdition?.name || '',
        region: project.region,
        county: project.county,
        subCounty: project.subCounty,
        category: project.category,
        isWinner,
        isParticipant,
        award,
      });
      if (i < project.students.length - 1) doc.addPage();
    }
  };

  const addPatronPage = async (doc: jsPDF, project: Project) => {
    const patron = users.find(u => u.id === (project as any).patronId);
    const name = patron?.name || user?.name || 'Patron';
    let isWinner = false;
    let isParticipant = false;
    let award: string | undefined = undefined;
    if (level === CompetitionLevel.NATIONAL) {
      const rk = nationalRankByProjectId.get(project.id);
      if (rk && rk <= 3) { isWinner = true; award = `Position ${rk}`; }
      else { isParticipant = true; }
    }
    await addCertificatePage({
      doc,
      name,
      type: 'Patron',
      projectTitle: project.title,
      school: project.school,
      levelFrom: level,
      levelTo: project.currentLevel,
      editionName: activeEdition?.name || '',
      region: project.region,
      county: project.county,
      subCounty: project.subCounty,
      tscNumber: patron?.tscNumber || user?.tscNumber,
      idNumber: patron?.idNumber || user?.idNumber,
      category: project.category,
      isWinner,
      isParticipant,
      award,
    });
  };

  const addSchoolPage = async (doc: jsPDF, project: Project) => {
    let isWinner = false;
    let isParticipant = false;
    let award: string | undefined = undefined;
    if (level === CompetitionLevel.NATIONAL) {
      const rk = nationalRankByProjectId.get(project.id);
      if (rk && rk <= 3) { isWinner = true; award = `Position ${rk}`; }
      else { isParticipant = true; }
    }
    await addCertificatePage({
      doc,
      name: project.school,
      type: 'School',
      projectTitle: project.title,
      school: project.school,
      levelFrom: level,
      levelTo: project.currentLevel,
      editionName: activeEdition?.name || '',
      region: project.region,
      county: project.county,
      subCounty: project.subCounty,
      category: project.category,
      isWinner,
      isParticipant,
      award,
    });
  };

  const addJudgePage = async (doc: jsPDF, judgeId: string, categories: string[]) => {
    const judge = users.find(u => u.id === judgeId);
    if (!judge) return;
    await addCertificatePage({
      doc,
      name: judge.name,
      type: 'Judge',
      levelFrom: level,
      editionName: activeEdition?.name || '',
      category: Array.from(new Set(categories)).join(', '),
      tscNumber: judge.tscNumber,
      idNumber: judge.idNumber,
    });
  };

  const handleDownloadBundle = async (bundle: 'School' | 'Patron' | 'Students' | 'Judges') => {
    try {
      ensurePublished();
      if (eligibleProjects.length === 0) return;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let pageCount = 0;

      if (bundle === 'Students') {
        for (let p = 0; p < eligibleProjects.length; p++) {
          const project = eligibleProjects[p];
          await addStudentPages(doc, project);
          pageCount++;
          if (p < eligibleProjects.length - 1) doc.addPage();
        }
      } else if (bundle === 'Patron') {
        for (let p = 0; p < eligibleProjects.length; p++) {
          const project = eligibleProjects[p];
          await addPatronPage(doc, project);
          pageCount++;
          if (p < eligibleProjects.length - 1) doc.addPage();
        }
      } else if (bundle === 'School') {
        const bySchool = new Map<string, Project[]>();
        for (const proj of eligibleProjects) {
          if (!bySchool.has(proj.school)) bySchool.set(proj.school, []);
          bySchool.get(proj.school)!.push(proj);
        }
        const schools = Array.from(bySchool.keys()).sort();
        for (let i = 0; i < schools.length; i++) {
          const school = schools[i];
          const group = bySchool.get(school)!;
          const sample = group[0];
          const titles = group.map(p => p.title).sort();
          await addCertificatePage({
            doc,
            name: school,
            type: 'School',
            projectTitle: undefined,
            school,
            levelFrom: level,
            levelTo: undefined,
            editionName: activeEdition?.name || '',
            region: sample.region,
            county: sample.county,
            subCounty: sample.subCounty,
            projectsList: titles,
          });
          pageCount++;
          if (i < schools.length - 1) doc.addPage();
        }
      } else if (bundle === 'Judges') {
        const judgeToCategories = new Map<string, Set<string>>();
        const projectIdSet = new Set(eligibleProjects.map(p => p.id));
        assignments
          .filter(a => a.competitionLevel === level && projectIdSet.has(a.projectId))
          .forEach(a => {
            const proj = projects.find(p => p.id === a.projectId);
            if (!proj) return;
            if (!judgeToCategories.has(a.judgeId)) judgeToCategories.set(a.judgeId, new Set());
            judgeToCategories.get(a.judgeId)!.add(proj.category);
          });
        const judgeIds = Array.from(judgeToCategories.keys());
        for (let i = 0; i < judgeIds.length; i++) {
          const jid = judgeIds[i];
          const cats = Array.from(judgeToCategories.get(jid) || []);
          await addJudgePage(doc, jid, cats);
          pageCount++;
          if (i < judgeIds.length - 1) doc.addPage();
        }
      }

      const schoolPart = isPatron ? mySchool.replace(/\s+/g, '_') + '_' : '';
      const fileName = `${schoolPart}${level}_Certificates_${bundle}.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error(e);
      alert((e as Error).message || 'Failed to generate certificates.');
    }
  };

  const LevelButton: React.FC<{ value: CompetitionLevel; icon: React.ReactNode }> = ({ value, icon }) => (
    <button
      className={`px-3 py-2 rounded-md border ${level === value ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'}`}
      onClick={() => setLevel(value)}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{value}</span>
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Certificates</h2>
        {isLevelPublished ? (
          <span className="text-sm text-green-600 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Available for selected level</span>
        ) : (
          <span className="text-sm text-yellow-600 flex items-center gap-1"><Award className="w-4 h-4" /> Available after publishing results</span>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          <LevelButton value={CompetitionLevel.SUB_COUNTY} icon={<BookOpen className="w-4 h-4" />} />
          <LevelButton value={CompetitionLevel.COUNTY} icon={<BookOpen className="w-4 h-4" />} />
          <LevelButton value={CompetitionLevel.REGIONAL} icon={<BookOpen className="w-4 h-4" />} />
          <LevelButton value={CompetitionLevel.NATIONAL} icon={<Trophy className="w-4 h-4" />} />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold"><School className="w-5 h-5" /> School Bundle</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">All school certificates for projects at the selected level.</p>
            <Button disabled={!isLevelPublished || eligibleProjects.length === 0} onClick={() => handleDownloadBundle('School')}>Download</Button>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold"><GraduationCap className="w-5 h-5" /> Patron Bundle</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Patron certificates for each project at the selected level.</p>
            <Button disabled={!isLevelPublished || eligibleProjects.length === 0} onClick={() => handleDownloadBundle('Patron')}>Download</Button>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold"><GraduationCap className="w-5 h-5" /> Students Bundle</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Certificates for all students across the selected level.</p>
            <Button disabled={!isLevelPublished || eligibleProjects.length === 0} onClick={() => handleDownloadBundle('Students')}>Download</Button>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold"><BookOpen className="w-5 h-5" /> Judges Bundle</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Certificates for judges who evaluated your projects at this level.</p>
            <Button disabled={!isLevelPublished} onClick={() => handleDownloadBundle('Judges')}>Download</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CertificatesPage;
