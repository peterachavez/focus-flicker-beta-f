import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AssessmentData } from '../pages/Index';
import { PDFReportGenerator } from '../utils/pdfReportGenerator';

interface ResultsDashboardProps {
  data: AssessmentData;
  tier: string;
}

const ResultsDashboard = ({ data, tier }: ResultsDashboardProps) => {
  // Determine if this report is for the Focus Flicker task.  Flex Sort
  // assessments do not include a task field; we treat absence as flexSort.
  const isFlicker = (data as any).task === 'focusFlicker';

  // Extract the appropriate primary score for display.  For Focus
  // Flicker assessments we prefer the computed attention_score when
  // available; otherwise we fall back to the flicker threshold stored
  // in cognitive_flexibility_score for backwards compatibility.  Flex
  // Sort reports always use the cognitive flexibility score.
  const primaryScore: number = isFlicker
    ? (data as any).attention_score ?? data.cognitive_flexibility_score
    : data.cognitive_flexibility_score;

  // Use a unified variable for all score displays.  For Flex Sort this is
  // equivalent to cognitive_flexibility_score; for Focus Flicker it
  // references the computed attention_score when provided.
  const scoreForDisplay = primaryScore;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#149854] bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Average';
    if (score >= 40) return 'Below Average';
    return 'Needs Improvement';
  };

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  // When viewing a Focus Flicker report we derive hit and false alarm rates
  // relative to the total number of trials.  For Flex Sort we preserve the
  // original calculations (shifts_achieved out of 5 and 15% penalty per error).
const totalTrials = data.trials?.length || 0;
const changeTrials = data.trials?.filter(t => t.change_occurred).length || 0;
const noChangeTrials = totalTrials - changeTrials;

const flickerHitPercent =
  isFlicker
    ? (changeTrials > 0 ? Math.round((data.shifts_achieved / changeTrials) * 100) : 0)
    : Math.round((data.shifts_achieved / 5) * 100);

const flickerFalseAlarmPercent =
  isFlicker
    ? (noChangeTrials > 0 ? Math.round((data.perseverative_errors / noChangeTrials) * 100) : 0)
    : 0; // (unused for Flex Sort path)

const flickerErrorControl =
  isFlicker ? Math.max(0, 100 - flickerFalseAlarmPercent)
            : Math.max(0, 100 - (data.perseverative_errors * 15));

  // Prepare chart data for Premium tier
  const getBlockPerformanceData = () => {
    const blocks = [];
    for (let i = 0; i < 6; i++) {
      const blockTrials = data.trials.slice(i * 6, (i + 1) * 6);
      const correct = blockTrials.filter(t => t.correct).length;
      const avgResponseTime = blockTrials.reduce((sum, t) => sum + t.response_time, 0) / blockTrials.length;
      
      blocks.push({
        block: `Block ${i + 1}`,
        accuracy: Math.round((correct / 6) * 100),
        responseTime: avgResponseTime.toFixed(1),
        rule: blockTrials[0]?.rule || 'unknown'
      });
    }
    return blocks;
  };

  const getResponseTimeData = () => {
    return data.trials.map((trial, index) => ({
      trial: index + 1,
      time: trial.response_time,
      correct: trial.correct
    }));
  };

  const exportToPDF = async () => {
    try {
      const pdfGenerator = new PDFReportGenerator();
      await pdfGenerator.generateReport(data);
      console.log('PDF report generated successfully');
    } catch (error) {
      console.error('Error generating PDF report:', error);
      alert('There was an error generating the PDF report. Please try again.');
    }
  };

  const exportToCSV = () => {
    // For Focus Flicker we output a simplified trial-level CSV that matches the
    // mapping checklist specification.  Each row contains the trial number,
    // whether a change occurred, the participant response, correctness,
    // response time, display duration, block identifier and the accuracy
    // percentage for that block.  For Flex Sort we preserve the original
    // column set to maintain backward compatibility.
    if (isFlicker) {
      // Compute accuracy for each block.  Trials are organised into blocks
      // of six; however we also respect the rule_block_number property
      // stored on each trial if available.  The accuracy is calculated as
      // the proportion of correct responses within the block, expressed
      // as a percentage.
      const blockTotals: Record<number, { correct: number; total: number }> = {};
      data.trials.forEach((trial, idx) => {
        const blockId = trial.rule_block_number || Math.floor(idx / 6) + 1;
        if (!blockTotals[blockId]) blockTotals[blockId] = { correct: 0, total: 0 };
        blockTotals[blockId].total += 1;
        if (trial.correct) blockTotals[blockId].correct += 1;
      });
      const blockAccuracy: Record<number, number> = {};
      Object.keys(blockTotals).forEach(key => {
        const id = Number(key);
        const { correct, total } = blockTotals[id];
        blockAccuracy[id] = total > 0 ? Math.round((correct / total) * 100) : 0;
      });
      // Header row
      const header = [
        'Trial',
        'Change_Occurred',
        'Response',
        'Correct',
        'Response_Time',
        'Display_MS',
        'Block_ID',
        'Block_Accuracy'
      ].join(',');
      const rows = data.trials.map((trial, idx) => {
        const blockId = trial.rule_block_number || Math.floor(idx / 6) + 1;
        return [
          trial.trial_number,
          typeof trial.change_occurred === 'boolean' ? trial.change_occurred : '',
          trial.user_choice,
          trial.correct,
          trial.response_time.toFixed(3),
          typeof trial.display_ms === 'number' ? trial.display_ms : '',
          blockId,
          blockAccuracy[blockId]
        ].join(',');
      });
      const csvContent = [header, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'focus-flicker-raw-data.csv';
      a.click();
    } else {
      // Original Flex Sort export including all columns.  Flex Sort trials
      // do not have change_occurred or display_ms values, so those
      // fields are left blank to maintain column alignment.
      const header = [
        'Trial',
        'Block',
        'Rule',
        'Correct',
        'Response_Time',
        'Perseverative',
        'Trial_Type',
        'Timestamp',
        'Adaptation_Latency',
        'Initial_Rule_Discovery_Latency',
        'Rule_Switch',
        'Consecutive_Errors',
        'Trial_In_Block',
        'Rule_Block_Number',
        'Change_Occurred',
        'Display_MS'
      ].join(',');
      const rows = data.trials.map((trial, index) => [
        trial.trial_number,
        Math.floor(index / 6) + 1,
        trial.rule || '',
        trial.correct,
        trial.response_time.toFixed(3),
        trial.perseverative,
        trial.trial_type,
        new Date(trial.timestamp).toISOString(),
        trial.adaptation_latency !== null ? trial.adaptation_latency : '',
        trial.initial_rule_discovery_latency !== null ? trial.initial_rule_discovery_latency : '',
        trial.rule_switch,
        trial.consecutive_errors,
        trial.trial_in_block,
        trial.rule_block_number,
        '',
        ''
      ].join(','));
      const csvContent = [header, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'focus-loop-raw-data.csv';
      a.click();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo/cogello-transparent.png"
            alt="Cogello"
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-3xl font-semibold text-gray-800 mb-2">
            {isFlicker ? 'Focus Flicker Report' : 'Flex Sort Report'}
          </h1>
          <p className="text-gray-600">
            Generated on {new Date(data.completed_at).toLocaleDateString()}
          </p>
          <div className="flex justify-center mt-2">
            <Badge variant={tier === 'pro' ? 'default' : 'secondary'} className="capitalize">
              {tier === 'free' ? 'Free' : tier === 'starter' ? 'Starter Plan' : 'Pro Plan'} Report
            </Badge>
          </div>
        </div>

        {/* Overview Cards with enhanced styling */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Primary score card */}
  <Card className={`border-2 shadow-lg hover:shadow-xl transition-shadow duration-200 ${getScoreColor(scoreForDisplay)}`}>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold mb-2">
                {scoreForDisplay}
              </div>
              <div className="text-sm font-medium mb-1">
                {isFlicker ? 'Attention Score' : 'Flexibility Score'}
              </div>
              <div className="text-xs">
                {getScoreLabel(scoreForDisplay)}
              </div>
            </CardContent>
          </Card>

          {/* Hits / Rule Adaptations */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-[#149854] mb-2">
                {data.shifts_achieved}
              </div>
              <div className="text-sm font-medium mb-1">
                {isFlicker ? 'Hits' : 'Rule Adaptations'}
              </div>
              <div className="text-xs text-gray-500">
                {isFlicker ? 'total detections' : 'out of 5 possible'}
              </div>
            </CardContent>
          </Card>

          {/* Errors / False Alarms */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-orange-600 mb-2">
                {data.perseverative_errors}
              </div>
              <div className="text-sm font-medium mb-1">
                {isFlicker ? 'False Alarms' : 'Perseverative Errors'}
              </div>
              <div className="text-xs text-gray-500">
                {isFlicker ? 'incorrect change reports' : 'rule-switching errors'}
              </div>
            </CardContent>
          </Card>

          {/* Response time / Detection time */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {formatTime(data.avg_response_time)}
              </div>
              <div className="text-sm font-medium mb-1">
                {isFlicker ? 'Avg Detection Time' : 'Avg Response Time'}
              </div>
              <div className="text-xs text-gray-500">
                {isFlicker ? 'speed of detection' : 'decision speed'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics for Starter and Pro with enhanced styling */}
        {(tier === 'starter' || tier === 'pro') && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">{isFlicker ? 'Attention Score' : 'Cognitive Flexibility'}</span>
                    <span className="text-sm text-gray-600 font-semibold">{scoreForDisplay}%</span>
                  </div>
                  <Progress value={scoreForDisplay} className="h-3 bg-gray-200">
                    <div 
                      className="h-full bg-[#149854] transition-all duration-500 rounded-full" 
                      style={{ width: `${scoreForDisplay}%` }}
                    />
                  </Progress>
                </div>
                
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">{isFlicker ? 'Hit Rate' : 'Rule Adaptation'}</span>
                    <span className="text-sm text-gray-600 font-semibold">
                      {isFlicker ? flickerHitPercent : Math.round((data.shifts_achieved / 5) * 100)}%
                    </span>
                  </div>
                  <Progress value={isFlicker ? flickerHitPercent : (data.shifts_achieved / 5) * 100} className="h-3 bg-gray-200">
                    <div
                      className="h-full bg-[#149854] transition-all duration-500 rounded-full"
                      style={{ width: `${isFlicker ? flickerHitPercent : (data.shifts_achieved / 5) * 100}%` }}
                    />
                  </Progress>
                </div>
                
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">{isFlicker ? 'False Alarm Control' : 'Error Control'}</span>
                    <span className="text-sm text-gray-600 font-semibold">
                      {isFlicker ? flickerErrorControl : Math.max(0, 100 - (data.perseverative_errors * 15))}%
                    </span>
                  </div>
                  <Progress value={isFlicker ? flickerErrorControl : Math.max(0, 100 - (data.perseverative_errors * 15))} className="h-3 bg-gray-200">
                    <div
                      className="h-full bg-[#149854] transition-all duration-500 rounded-full"
                      style={{ width: `${isFlicker ? flickerErrorControl : Math.max(0, 100 - (data.perseverative_errors * 15))}%` }}
                    />
                  </Progress>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Adaptive Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Guided Mode</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      data.guided_mode_triggered 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {data.guided_mode_triggered ? 'Activated' : 'Not Needed'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Rule Training</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      data.rule_training_triggered 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {data.rule_training_triggered ? 'Required' : 'Not Needed'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Adaptation Latency</span>
                    <span className="text-sm text-gray-600">
                      {data.adaptation_latency} trials
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Overall Accuracy</span>
                    <span className="text-sm text-gray-600">
                      {Math.round((data.trials.filter(t => t.correct).length / data.trials.length) * 100)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pro Charts with Cogello green styling */}
        {tier === 'pro' && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Block Performance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getBlockPerformanceData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="block" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #149854',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <Bar dataKey="accuracy" fill="#149854" name="Accuracy %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Response Time Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getResponseTimeData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="trial" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #149854',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="time" 
                      stroke="#149854" 
                      strokeWidth={3}
                      dot={{ fill: '#149854', strokeWidth: 2, r: 4 }}
                      name="Response Time (s)" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Enhanced AI Summary */}
        {(tier === 'starter' || tier === 'pro') && (
          <Card className="mb-8 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">AI-Generated Interpretation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                {/* Executive Summary */}
                <p className="text-gray-700 leading-relaxed mb-4">
                  <strong>Executive Summary:</strong>{' '}
                  {isFlicker ? (
                    (() => {
                      // Flicker-specific executive summary
                      const hits = data.shifts_achieved;
                      const falseAlarms = data.perseverative_errors;

                      const totalTrials = data.trials?.length || 0;
                      const changeTrials = data.trials?.filter(t => t.change_occurred).length || 0;
                      const noChangeTrials = totalTrials - changeTrials;

                      const hitRate = changeTrials > 0 ? Math.round((hits / changeTrials) * 100) : 0;
                      const falseAlarmPercent = noChangeTrials > 0 ? Math.round((falseAlarms / noChangeTrials) * 100) : 0;
                    const errorControl = Math.max(0, 100 - falseAlarmPercent);

                      const threshold = scoreForDisplay;
const label = getScoreLabel(threshold).toLowerCase();
const meanRT = data.avg_response_time;

return ` Your performance on the Focus Flicker assessment demonstrates ${label} change detection ability. ` +
       `You detected ${hits} changes with ${falseAlarms} false alarms across ${totalTrials} trials ` +
       `(hit rate ${hitRate}%, error control ${errorControl}%). ` +
       `Your attention score of ${threshold} on a 0–100 scale indicates ${label} sensitivity to rapid changes. ` +
       `Your average detection time of ${meanRT.toFixed(1)}s reflects ${meanRT <= 2.0 ? 'rapid and confident detection' : meanRT <= 3.0 ? 'typical detection speed with adequate deliberation' : 'careful, methodical detection that prioritizes accuracy'}.`;
                    })()
                  ) : (
                    ` Your performance on the Flex Sort assessment demonstrates ${getScoreLabel(data.cognitive_flexibility_score).toLowerCase()} cognitive flexibility. You successfully achieved ${data.shifts_achieved} out of 5 possible rule adaptations, indicating ${data.shifts_achieved >= 4 ? 'excellent' : data.shifts_achieved >= 3 ? 'good' : 'developing'} ability to adapt to changing task demands.`
                  )}
                </p>

                {/* Detailed Analysis */}
                <p className="text-gray-700 leading-relaxed mb-4">
                  <strong>Detailed Analysis:</strong>{' '}
                  {isFlicker ? (
                    (() => {
                      const falseAlarms = data.perseverative_errors;
                      const meanRT = data.avg_response_time;
                      const falseAlarmComment = falseAlarms <= 2
                        ? 'minimal impulsive responding and excellent inhibitory control'
                        : falseAlarms <= 5
                          ? 'moderate impulsivity with occasional false positives'
                          : 'significant impulsive responding and difficulty inhibiting change reports';
                      const rtComment = meanRT <= 2.0
                        ? 'rapid and confident detection'
                        : meanRT <= 3.0
                          ? 'typical detection speed with adequate deliberation'
                          : 'careful, methodical detection that prioritizes accuracy';
                      return `With ${falseAlarms} false alarms, your performance suggests ${falseAlarmComment}. Your average detection time of ${meanRT.toFixed(1)}s reflects ${rtComment}.`;
                    })()
                  ) : (
                    `With ${data.perseverative_errors} perseverative errors, your performance suggests ${data.perseverative_errors <= 2 ? 'strong inhibitory control and flexible thinking' : data.perseverative_errors <= 5 ? 'moderate difficulty with rule switching but overall adequate flexibility' : 'significant challenges in cognitive flexibility requiring attention'}. Your average response time of ${formatTime(data.avg_response_time)} indicates ${data.avg_response_time <= 2.0 ? 'efficient and confident decision-making' : data.avg_response_time <= 3.0 ? 'typical processing speed with adequate deliberation' : 'careful, methodical responding that prioritizes accuracy'}.`
                  )}
                </p>

                {/* Cognitive Insights */}
                <p className="text-gray-700 leading-relaxed mb-4">
                  <strong>Cognitive Insights:</strong>{' '}
                  {isFlicker ? (
                    (() => {
                      const guided = data.guided_mode_triggered;
                      const hitRate = totalTrials > 0 ? Math.round((data.shifts_achieved / totalTrials) * 100) : 0;
                      const falseAlarms = data.perseverative_errors;
                      return guided
                        ? 'The adaptive system activated guided mode to provide additional support, indicating some difficulty with sustained attention or inhibitory control. This information can inform strategies to improve vigilance and reduce impulsive responding.'
                        : 'You demonstrated consistent change detection without requiring adaptive support, indicating strong attentional control and self-regulation.';
                    })()
                  ) : (
                    `${data.guided_mode_triggered ? 'The adaptive system activated guided mode to provide additional support, suggesting some difficulty with rapid rule switching. This is valuable information for understanding your cognitive processing style.' : 'You demonstrated consistent performance without requiring adaptive support, indicating strong self-regulation and flexible thinking skills.'}${data.rule_training_triggered ? ' Rule training was triggered, indicating significant difficulty with implicit rule learning that may benefit from explicit instruction.' : ''}`
                  )}
                </p>

                {tier === 'pro' && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 mb-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Clinical Implications</h4>
                      <p className="text-blue-700 text-sm mb-2">
                        These results may inform clinical decision-making regarding executive function,
                        {isFlicker ? ' attentional vigilance, inhibitory control, and adaptive reasoning abilities in change detection tasks. Performance patterns suggest:' : 'executive function, cognitive flexibility, and adaptive reasoning abilities. Performance patterns suggest:'}
                      </p>
                      <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
                        <li>
                          {isFlicker ? (
                            scoreForDisplay >= 80
                              ? 'Strong attentional vigilance with minimal intervention needs'
                              : scoreForDisplay >= 60
                                ? 'Good change detection that may benefit from targeted strategies'
                                : 'Difficulty detecting subtle changes; supportive strategies may be warranted'
                          ) : (
                            scoreForDisplay >= 80
                              ? 'Strong executive functioning with minimal intervention needs'
                              : scoreForDisplay >= 60
                                ? 'Moderate executive functioning that may benefit from targeted strategies'
                                : 'Executive functioning challenges that may require comprehensive intervention'
                          )}
                        </li>
                        <li>
                          {isFlicker ? (
                            data.perseverative_errors <= 2
                              ? 'Excellent inhibitory control and selective attention'
                              : 'Consider interventions to reduce impulsive responding and improve inhibitory control'
                          ) : (
                            data.perseverative_errors <= 2
                              ? 'Excellent inhibitory control and cognitive flexibility'
                              : 'Consider strategies to improve cognitive flexibility and reduce perseverative responding'
                          )}
                        </li>
                        <li>
                          {isFlicker
                            ? `Detection speed appears ${data.avg_response_time <= 2.5 ? 'optimal' : 'deliberate'}, with no significant concerns`
                            : `Processing speed appears ${data.avg_response_time <= 2.5 ? 'optimal' : 'deliberate'} with no significant concerns`}
                        </li>
                      </ul>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                      <h4 className="font-semibold text-amber-800 mb-2">Legal/Educational Summary</h4>
                      <p className="text-amber-700 text-sm">
                        <strong>For Educational/Legal Purposes:</strong> {isFlicker ? (
                          (() => {
                            const label = getScoreLabel(scoreForDisplay).toLowerCase();
                            const accommodationNeeded = scoreForDisplay < 70;
                            return `This assessment provides objective measures of visual change detection ability that may be relevant for educational accommodations, workplace adaptations, or legal considerations. The ${label} performance suggests ${accommodationNeeded ? 'potential need for accommodations or modifications to support effective monitoring and vigilance in tasks requiring rapid change detection' : 'typical change detection abilities with standard expectations appropriate'}. Results should be interpreted by qualified professionals in conjunction with other assessment data and clinical observations.`;
                          })()
                        ) : (
                          (() => {
                            const label = getScoreLabel(scoreForDisplay).toLowerCase();
                            const accommodationNeeded = scoreForDisplay < 70;
                            return `This assessment provides objective measures of cognitive flexibility that may be relevant for educational accommodations, workplace adaptations, or legal considerations. The ${label} performance suggests ${accommodationNeeded ? 'potential need for accommodations or modifications to support optimal performance in demanding cognitive tasks' : 'typical cognitive flexibility abilities with standard expectations appropriate'}. Results should be interpreted by qualified professionals in conjunction with other assessment data and clinical observations.`;
                          })()
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Options for Pro with enhanced styling */}
        {tier === 'pro' && (
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Professional Export Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={exportToPDF} 
                  className="bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Export Comprehensive Report (PDF)
                </Button>
                <Button 
                  onClick={exportToCSV} 
                  variant="outline"
                  className="border-[#149854] text-[#149854] hover:bg-[#149854]/10 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Download Raw Data (CSV)
                </Button>
               {/*
                <Button 
                  variant="outline" 
                  className="text-blue-600 border-blue-600 hover:bg-blue-50 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Professional Formatting
                </Button> */}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                PDF reports include clinical interpretations, legal summaries, and detailed performance analytics.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;
