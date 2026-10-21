import { AlertTriangle, Database, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { hapticsSupported } from '../feedback/haptics'
import type { MotionPreference, QualityPreference } from '../persistence/schema'
import { useProgress } from '../progress/ProgressContext'
import { Button } from '../ui/components/Button'
import { Sheet } from '../ui/components/Sheet'
import { Segmented, Toggle } from '../ui/components/Toggle'

export function SettingsSheet({ open, onClose, onReset }: { open: boolean; onClose: () => void; onReset: () => void }) {
  const { save, updateSettings } = useProgress()
  const s = save.settings
  const [confirming, setConfirming] = useState(false)

  const close = () => {
    setConfirming(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={close} title="Settings" labelledBy="settings-title">
      {!confirming ? (
        <>
          <div className="divide-y divide-white/[0.06]">
            <Segmented<MotionPreference>
              label="Animations"
              value={s.motion}
              onChange={(motion) => updateSettings({ motion })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'full', label: 'On' },
                { value: 'reduced', label: 'Reduced' },
              ]}
            />
            <Toggle label="Sound effects" checked={s.sound} onChange={(sound) => updateSettings({ sound })} />
            <Toggle
              label="Vibration"
              description={hapticsSupported ? undefined : 'Not supported by this browser'}
              checked={s.haptics && hapticsSupported}
              disabled={!hapticsSupported}
              onChange={(haptics) => updateSettings({ haptics })}
            />
            <Segmented<QualityPreference>
              label="Graphics"
              value={s.quality}
              onChange={(quality) => updateSettings({ quality })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'high', label: 'High' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'saver', label: 'Saver' },
              ]}
            />
          </div>
          <div className="mt-5 rounded-2xl border border-coral/20 bg-coral/[0.05] p-3.5">
            <div className="mb-1 text-sm font-semibold text-white">Reset progress</div>
            <p className="mb-3 text-xs text-haze">Erase your World Atlas, Echo Rounds, high scores and unlocked modes.</p>
            <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => setConfirming(true)}>
              Reset progress…
            </Button>
          </div>
          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-haze">
            <Database size={13} className="mt-0.5 shrink-0" />
            Map data © Natural Earth (public domain). Country data from mledoze/countries (ODbL). Earth imagery: NASA Blue
            Marble. Progress is saved on this device only.
          </p>
        </>
      ) : (
        <div className="animate-rise-in py-2 text-center">
          <AlertTriangle className="mx-auto text-coral" size={36} />
          <h3 className="mt-3 font-display text-lg font-semibold text-white">Erase all progress?</h3>
          <p className="mt-1 text-sm text-haze">
            This permanently deletes your discovered countries, mastery, Echo Rounds, high scores and unlocks. Settings are kept.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Button block onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              block
              variant="danger"
              onClick={() => {
                onReset()
                close()
              }}
            >
              Erase everything
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
