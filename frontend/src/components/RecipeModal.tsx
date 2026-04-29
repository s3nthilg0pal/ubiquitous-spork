import { Modal, ModalOverlay, Dialog, Heading, Button } from 'react-aria-components';
import type { Meal } from '../api';

interface Props {
  meal: Meal | null;
  onClose: () => void;
}

export default function RecipeModal({ meal, onClose }: Props) {
  return (
    <ModalOverlay
      isOpen={!!meal}
      onOpenChange={(open) => { if (!open) onClose(); }}
      className="modal-overlay"
      isDismissable
    >
      <Modal className="modal-content">
        <Dialog className="modal-dialog">
          {() => meal && (
            <>
              <Button className="close-btn" onPress={onClose} aria-label="Close">×</Button>
              <Heading slot="title">{meal.name}</Heading>
              <h3>Ingredients</h3>
              <ul>
                {meal.ingredients?.map((ing, i) => <li key={i}>{ing}</li>)}
              </ul>
              <h3>Method</h3>
              <ol>
                {meal.method?.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
