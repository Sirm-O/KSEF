import React, { useState, useEffect, useContext } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Project } from '../../types';
import { ProjectScores } from '../../context/AppContext';

interface TieBreakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  scores: ProjectScores;
  onSave: (project: Project, newScoreA: number) => void;
}

const TieBreakerModal: React.FC<TieBreakerModalProps> = ({ isOpen, onClose, project, scores, onSave }) => {
  const [newScoreA, setNewScoreA] = useState<string>(scores.scoreA?.toFixed(2) || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setNewScoreA(scores.scoreA?.toFixed(2) || '');
    setError('');
  }, [project, scores]);

  const handleSave = () => {
    const score = parseFloat(newScoreA);
    if (isNaN(score) || score < 0 || score > 30) {
      setError('Score must be a number between 0 and 30.');
      return;
    }
    onSave(project, score);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Resolve Tie for: ${project.title}`}>
      <div className="space-y-4">
        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
          This project is tied with another. Adjust the Section A score to break the tie. The final total score will be recalculated automatically.
        </p>
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
          <p className="font-semibold">Current Total Score</p>
          <p className="text-3xl font-bold text-primary">{scores.totalScore.toFixed(2)}</p>
          <div className="flex justify-around mt-2 text-sm">
            <span>Part A: {scores.scoreA?.toFixed(2) ?? 'N/A'}</span>
            <span>Part B&C: {scores.scoreBC?.toFixed(2) ?? 'N/A'}</span>
          </div>
        </div>
        <div>
          <label htmlFor="newScoreA" className="block font-medium mb-1">New Section A Score (0-30)</label>
          <input
            type="number"
            id="newScoreA"
            value={newScoreA}
            onChange={(e) => setNewScoreA(e.target.value)}
            min="0"
            max="30"
            step="0.01"
            className="w-full p-2 rounded-md bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 focus:border-primary focus:ring-primary"
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save & Resolve Tie</Button>
        </div>
      </div>
    </Modal>
  );
};

export default TieBreakerModal;