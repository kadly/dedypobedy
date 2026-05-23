import React from 'react';
import * as styles from './ModalContact.module.css';

const ModalContact = ({ isOpen, onClose, ModelComponent }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Связаться с продавцом</h2>
        <div className={styles.iconsContainer}>
          <a href="https://telegram.me/gmitry" target="_blank" rel="noopener noreferrer">
            <img className={styles.icon} src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" />
          </a>
          <a href="https://wa.me/7231280168" target="_blank" rel="noopener noreferrer">
            <img className={styles.icon} src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" />
          </a>
        </div>
        <div className={styles.modalText}>
          {ModelComponent ? <ModelComponent /> : "Информация о модели недоступна."}
        </div>
        <button className={styles.closeButton} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
};

export default ModalContact;
